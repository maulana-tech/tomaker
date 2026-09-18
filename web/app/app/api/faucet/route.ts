// SPDX-License-Identifier: Apache-2.0

import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  parseEther,
  parseUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PrivyClient } from "@privy-io/node";
import {
  fundingStoreConfigured,
  reserveFunding,
  recordFunding,
} from "@/lib/faucetStore";
import { appConfig, TESTNET_CHAIN_ID, viemChain } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Testnet cash faucet, funded from a server-side key. sdUSD has no public
 * `mint`, so the route transfers from a funded account instead: it grants ATS
 * KYC to the recipient (so they can deposit into SY) and sends test cash plus a
 * little BOT for gas. The market admin key never leaves the server; it is read
 * from `FAUCET_PRIVATE_KEY` and is never logged.
 *
 * This route only runs on Hedera testnet and is disabled unless the key is set.
 */

const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// BOT Chain has no ATS factory, so eligibility is the plain ERC-3643 pair the
// bond reads: an identity registry that says a holder is verified, and a
// compliance module that clears the transfer. Both must say yes before a
// deposit into SY can succeed.
const REGISTRY_ABI = [
  {
    type: "function",
    name: "isVerified",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "setVerified",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "verified", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const COMPLIANCE_ABI = [
  {
    type: "function",
    name: "setAllowed",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
] as const;

function noStore(body: unknown, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

function cashAmount(cfg: ReturnType<typeof appConfig>): bigint {
  return parseUnits(
    process.env.FAUCET_CASH_AMOUNT ?? cfg.faucetAmount,
    cfg.underlyingDecimals,
  );
}

/** Fail closed: funding always requires an authenticated owner of the embedded wallet. */
async function verifyFundingOwner(
  request: Request,
  recipient: string,
): Promise<{ userId?: string; error?: string; status?: number }> {
  const secret = process.env.PRIVY_APP_SECRET;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!secret?.trim() || !appId?.trim())
    return { error: "Privy authentication is not configured", status: 503 };
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token)
    return {
      error: "A Privy session token is required to fund this wallet",
      status: 401,
    };
  try {
    const privy = new PrivyClient({ appId, appSecret: secret });
    const claims = await privy.utils().auth().verifyAccessToken(token);
    const user = await privy.users()._get(claims.user_id);
    const owns = user.linked_accounts.some(
      (account) =>
        account.type === "wallet" &&
        account.wallet_client_type === "privy" &&
        account.chain_type === "ethereum" &&
        account.address.toLowerCase() === recipient.toLowerCase(),
    );
    return owns
      ? { userId: claims.user_id }
      : {
          error:
            "The requested address is not an embedded wallet linked to this Privy user",
          status: 403,
        };
  } catch {
    return { error: "Privy authentication failed", status: 401 };
  }
}

export async function GET() {
  const cfg = appConfig();
  const enabled =
    Boolean(
      process.env.FAUCET_PRIVATE_KEY &&
        process.env.PRIVY_APP_SECRET &&
        process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    ) &&
    fundingStoreConfigured() &&
    cfg.faucetEnabled &&
    cfg.chainId === TESTNET_CHAIN_ID;
  return noStore({
    enabled,
    token: cfg.yieldSource.underlyingAddress,
    amount: process.env.FAUCET_CASH_AMOUNT ?? cfg.faucetAmount,
    decimals: cfg.underlyingDecimals,
    gas: process.env.FAUCET_BOT_AMOUNT ?? "20",
    chainId: cfg.chainId,
  });
}

export async function POST(request: Request) {
  const cfg = appConfig();
  const key = process.env.FAUCET_PRIVATE_KEY;
  if (!cfg.faucetEnabled || !key) {
    return noStore({ error: "Test cash faucet is disabled" }, { status: 403 });
  }
  if (cfg.chainId !== TESTNET_CHAIN_ID) {
    return noStore(
      { error: "The test cash faucet only runs on Hedera testnet" },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return noStore({ error: "Expected a JSON body" }, { status: 400 });
  }

  const address = (payload as { address?: unknown } | null)?.address;
  if (typeof address !== "string" || !isAddress(address)) {
    return noStore(
      { error: "address must be a 0x EVM address" },
      { status: 400 },
    );
  }

  const recipient = getAddress(address);
  const owner = await verifyFundingOwner(request, recipient);
  if (owner.error || !owner.userId)
    return noStore({ error: owner.error }, { status: owner.status ?? 401 });
  if (!fundingStoreConfigured())
    return noStore(
      { error: "Durable faucet storage is not configured" },
      { status: 503 },
    );
  let allocationId: string | null = null;
  let phase = "reserved";
  const hashes: { kind: string; hash: string }[] = [];

  try {
    // Validate amounts before reserving or submitting any transaction.
    const amount = cashAmount(cfg);
    const gasTopUp = parseEther(process.env.FAUCET_BOT_AMOUNT ?? "20");
    if (amount <= 0n || gasTopUp < 0n)
      return noStore(
        { error: "Invalid faucet funding amount" },
        { status: 500 },
      );
    const reservation = await reserveFunding(owner.userId, recipient);
    if (!reservation.created) {
      const existing = reservation.allocation;
      // Never expose another identity's funding record if its wallet was relinked.
      if (
        existing.user_id !== owner.userId ||
        existing.wallet !== recipient.toLowerCase()
      ) {
        return noStore(
          { error: "This identity or wallet already has a funding allocation" },
          { status: 429 },
        );
      }
      if (existing.status === "complete")
        return noStore({
          ok: true,
          hashes: JSON.parse(existing.hashes),
          allocationId: existing.id,
        });
      return noStore(
        {
          error:
            "Funding was already started. Contact the demo operator to reconcile pending or partial funding; retrying will not send duplicate funds.",
          allocationId: existing.id,
          phase: existing.phase,
          hashes: JSON.parse(existing.hashes),
        },
        { status: 409 },
      );
    }
    allocationId = reservation.allocation.id;
    const checkpoint = async (nextPhase: string) => {
      phase = nextPhase;
      await recordFunding(allocationId!, "running", phase, hashes);
    };
    const confirm = async (hash: `0x${string}`) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        ...receiptWait,
      });
      if (receipt.status !== "success")
        throw new Error("Funding transaction reverted");
    };
    const account = privateKeyToAccount(key as `0x${string}`);
    const transport = http(cfg.rpcUrl);
    const chain = viemChain(cfg);
    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });
    const receiptWait = { timeout: 120_000, pollingInterval: 2_000 };

    const registry = cfg.contracts.registry as Address | undefined;
    const compliance = cfg.contracts.compliance as Address | undefined;
    if (!registry || !compliance) {
      // Without both, the wallet would be funded and still be unable to
      // deposit, so fail before spending anything.
      return noStore(
        { error: "Eligibility contracts are not configured for this market." },
        { status: 503 },
      );
    }

    const verified = (await publicClient.readContract({
      address: registry,
      abi: REGISTRY_ABI,
      functionName: "isVerified",
      args: [recipient],
    })) as boolean;
    if (!verified) {
      await checkpoint("kyc-submitting");
      const registryHash = await walletClient.writeContract({
        address: registry,
        abi: REGISTRY_ABI,
        functionName: "setVerified",
        args: [recipient, true],
      });
      hashes.push({ kind: "kyc", hash: registryHash });
      await confirm(registryHash);

      const complianceHash = await walletClient.writeContract({
        address: compliance,
        abi: COMPLIANCE_ABI,
        functionName: "setAllowed",
        args: [recipient, true],
      });
      hashes.push({ kind: "compliance", hash: complianceHash });
      await checkpoint("kyc-submitted");
      await confirm(complianceHash);
      await checkpoint("kyc-confirmed");
    }

    await checkpoint("cash-submitting");
    const cashHash = await walletClient.writeContract({
      address: cfg.yieldSource.underlyingAddress as Address,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipient, amount],
    });
    hashes.push({ kind: "cash", hash: cashHash });
    await checkpoint("cash-submitted");
    await confirm(cashHash);
    await checkpoint("cash-confirmed");

    if (gasTopUp > 0n) {
      await checkpoint("gas-submitting");
      const gasHash = await walletClient.sendTransaction({
        to: recipient,
        value: gasTopUp,
      });
      hashes.push({ kind: "gas", hash: gasHash });
      await checkpoint("gas-submitted");
      await confirm(gasHash);
      await checkpoint("gas-confirmed");
    }

    await recordFunding(allocationId, "complete", "complete", hashes);
    return noStore({ ok: true, hashes, allocationId });
  } catch {
    if (allocationId)
      await recordFunding(allocationId, "failed", phase, hashes).catch(
        () => undefined,
      );
    // RPC error messages may include the signed payload; keep them off the public endpoint.
    return noStore(
      {
        error:
          "Faucet funding failed. Contact the demo operator before retrying.",
        allocationId,
        phase,
        hashes,
      },
      { status: 502 },
    );
  }
}
