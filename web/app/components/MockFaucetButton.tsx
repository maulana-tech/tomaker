// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState } from "react";
import { useToMaker } from "@/lib/useToMaker";
import { encodeFunctionData, type Address } from "viem";

type Phase = "idle" | "working" | "done" | "error";

const MINT_ABI = [{ type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }] as const;
const SET_VERIFIED_ABI = [{ type: "function", name: "setVerified", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "verified", type: "bool" }], outputs: [] }] as const;
const SET_ALLOWED_ABI = [{ type: "function", name: "setAllowed", stateMutability: "nonpayable", inputs: [{ name: "account", type: "address" }, { name: "allowed", type: "bool" }], outputs: [] }] as const;

export function MockFaucetButton({
  onDone,
}: {
  onDone?: () => void;
}) {
  const { cfg, address } = useToMaker();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!cfg.faucetEnabled || cfg.chainId !== 968) return null;

  const busy = phase === "working";

  async function runFaucet() {
    if (!address) return;
    const wallet = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!wallet) {
      setError("No injected wallet found");
      setPhase("error");
      return;
    }

    const send = async (to: Address, data: `0x${string}`): Promise<string> => {
      const hash = await wallet.request({
        method: "eth_sendTransaction",
        params: [{ from: address, to, data }],
      }) as string;
      return hash;
    };

    try {
      setPhase("working");
      setError(null);

      const cashAmount = 1000n * 10n ** BigInt(cfg.underlyingDecimals);
      const mintData = encodeFunctionData({ abi: MINT_ABI, functionName: "mint", args: [address, cashAmount] });
      await send(cfg.contracts.underlying as Address, mintData);

      const registryData = encodeFunctionData({ abi: SET_VERIFIED_ABI, functionName: "setVerified", args: [address, true] });
      await send(cfg.contracts.registry as Address, registryData);

      const complianceData = encodeFunctionData({ abi: SET_ALLOWED_ABI, functionName: "setAllowed", args: [address, true] });
      await send(cfg.contracts.compliance as Address, complianceData);

      setPhase("done");
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  const label = !address
    ? "Connect wallet to fund"
    : busy
      ? "Funding wallet..."
      : phase === "done"
        ? "Wallet funded ✓"
        : phase === "error"
          ? "Retry"
          : "Get test cash + verify";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={runFaucet}
        disabled={busy || !address || phase === "done"}
        className="btn-solid"
      >
        {busy && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border border-paper/40 border-t-ink" />
        )}
        {label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {phase === "done" && <p className="text-xs text-green-600">Test cash minted, KYC granted, and compliance cleared.</p>}
    </div>
  );
}
