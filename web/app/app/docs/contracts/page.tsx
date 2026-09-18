// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocsHeader, DocsPager } from "@/components/DocsBlocks";
import { appConfig } from "@/lib/config";
import { TESTNET_DEPLOYMENT } from "@/lib/deployments";

export const metadata: Metadata = { title: "Deployed contracts" };

export default function ContractsPage() {
  const cfg = appConfig();
  const rows: { name: string; address: string; note: string }[] = [
    {
      name: "Bond (ERC-3643 security token)",
      address: TESTNET_DEPLOYMENT.bondToken,
      note: "The permissioned bond; coupons and maturity cashflow",
    },
    {
      name: "Settlement adapter (BOND)",
      address: cfg.contracts.bond ?? "",
      note: "The app's bond handle; prices and settles the bond position",
    },
    {
      name: "SY vault (StandardizedYieldVault)",
      address: cfg.contracts.sy,
      note: "Cash in, SY shares out; wraps the bond through the strategy",
    },
    {
      name: "Bond strategy",
      address: cfg.contracts.strategy ?? "",
      note: "Holds the bond and values it in the cash denomination",
    },
    {
      name: "Cash token (tUSD, test only)",
      address: cfg.contracts.underlying ?? "",
      note: "6-decimal demonstration cash; not USDC and not redeemable",
    },
    {
      name: "PT token (PrincipalToken)",
      address: cfg.contracts.pt,
      note: "ERC-20; mint/burn gated to the tokenizer",
    },
    {
      name: "YT token (YieldToken)",
      address: cfg.contracts.yt,
      note: "ERC-20; settles yield on every balance change",
    },
    {
      name: "Tokenizer",
      address: cfg.contracts.tokenizer,
      note: "Escrows SY; split, recombine, claim, redeem",
    },
    {
      name: "AMM (AmmMarket)",
      address: cfg.contracts.market,
      note: "Time-decay pool; YT routes through it",
    },
    {
      name: "Orderbook",
      address: cfg.contracts.orderbook ?? "",
      note: "PT/SY price-time limit-order book",
    },
  ];

  return (
    <article>
      <DocsHeader
        kicker="Reference"
        title="Deployed contracts"
        summary="The BOT Chain deployment, the current market parameters, and how to verify that the deployed bytecode matches the public source."
      />

      <div className="docs-prose mt-8">
        <h2>BOT Chain testnet (chain 968)</h2>
        <p>
          The bond and the market around it are both created by{" "}
          <code>contracts/script/DeployBotChain.s.sol</code>, which writes every address it created
          to <code>contracts/deployments/botchain-testnet.json</code>. The addresses below are the
          same ones the app is built with. Open any address on{" "}
          <a href="https://scan.bohr.life">the testnet explorer</a>; mainnet (chain 677) is on{" "}
          <a href="https://scan.botchain.ai">scan.botchain.ai</a>.
        </p>
        <p>
          The table is empty until that script has been run against BOT Chain. An address that is
          not there has not been deployed.
        </p>
      </div>

      <div className="docs-table-scroll mt-5">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              <th className="border-b border-ink/15 py-2 pr-4 text-left font-medium text-ink">
                Component
              </th>
              <th className="border-b border-ink/15 py-2 pr-4 text-left font-medium text-ink">
                Address
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name}>
                <td className="border-b border-ink/10 py-3 pr-4 align-top">
                  <p className="text-ink">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-ash">{c.note}</p>
                </td>
                <td className="border-b border-ink/10 py-3 pr-4 align-top">
                  <a
                    href={`https://hashscan.io/testnet/contract/${c.address}`}
                    className="break-all font-mono text-[12px] text-smoke underline decoration-ink/20 underline-offset-4 hover:text-ink"
                  >
                    {c.address}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="docs-prose mt-10">
        <h2>Current market parameters</h2>
        <ul>
          <li>
            <strong>Bond:</strong> a permissioned ERC-3643 security. An identity registry and a
            compliance module gate it; the market reuses those controls, so a wallet that is not
            verified cannot deposit into SY or move PT/YT.
          </li>
          <li>
            <strong>Cash:</strong> tUSD, a testnet demonstration token. It is not a stablecoin,
            not redeemable, and minted only by the deployment for the demo.
          </li>
          <li>
            <strong>Decimals:</strong> 18 throughout &mdash; cash, bond, SY, PT and YT &mdash; with
            rate math in 18-decimal WAD. The app still reads the cash decimals from the manifest
            rather than assuming, so a 6-decimal denomination would format correctly too.
          </li>
          <li>
            <strong>Maturity:</strong> fixed per deployment and shown in the app. A separate
            historical short-maturity market demonstrates settlement after maturity; the current market has a 90-day term.
          </li>
          <li>
            <strong>Fees:</strong> the swap and orderbook taker fees are bounded and adjustable only
            by the configured admin; the TWAP window is 30 minutes.
          </li>
        </ul>

        <h2>Verifying the deployment</h2>
        <p>
          The contracts are built reproducibly from the Foundry project: dependencies are pinned
          in <code>contracts/dependencies.lock.json</code>. Nothing is verified on Sourcify yet,
          because nothing is deployed yet. Once a market exists, verify a contract with:
        </p>
        <pre>
          <code>{`forge verify-contract <address> <path/to/Contract.sol:Contract> \\
  --chain 968 --verifier sourcify`}</code>
        </pre>
        <p>
          A <code>match</code> means Sourcify recompiled the source and reproduced the deployed
          bytecode. Check the contract&rsquo;s explorer page separately for its displayed verification status. Rebuild locally
          with <code>forge build</code> and compare against the recorded build inputs; the contracts
          repository is the source of truth for the deployed bytecode.
        </p>

        <h2>Admin surface</h2>
        <p>
          The contracts are <strong>non-upgradeable</strong>. The SY vault&rsquo;s strategy is bound
          immutably and its admin can only set a deposit cap; the AMM, tokenizer, and orderbook
          admins can set bounded, event-emitting fees. None of those controls can redirect holder
          balances, set the exchange rate, or mint. Details in{" "}
          <Link href="/docs/security">Security and risks</Link>.
        </p>
      </div>

      <div className="mt-8">
        <Callout label="Address drift">
          The app components use <code>NEXT_PUBLIC_*</code> configuration with the checked-in
          deployment as their fallback, and bond provenance uses that same source. If they ever
          disagree, the on-chain address in the manifest is authoritative.
        </Callout>
      </div>

      <DocsPager current="/docs/contracts" />
    </article>
  );
}
