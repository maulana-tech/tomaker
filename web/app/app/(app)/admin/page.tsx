// SPDX-License-Identifier: Apache-2.0

"use client";

import { useEffect, useState } from "react";
import type { ErrorContext } from "@/lib/errors";
import { bpsToPercent, shortAddress } from "@/lib/format";
import { useToMaker } from "@/lib/useToMaker";
import { SubmitButton } from "@/components/SubmitButton";
import { TxStatus } from "@/components/TxStatus";

interface FeeState {
  swapAdmin: string;
  swapFeeBps: bigint;
  yieldAdmin: string;
  yieldFeeBps: bigint;
  orderbookAdmin: string;
  orderbookFeeBps: bigint;
}

export default function AdminPage() {
  const { cfg, client, address, phase, submit } = useToMaker();
  const [fees, setFees] = useState<FeeState | null>(null);
  const [readError, setReadError] = useState<unknown>(null);
  const [swapFee, setSwapFee] = useState("");
  const [yieldFee, setYieldFee] = useState("");
  const [orderbookFee, setOrderbookFee] = useState("");
  const [activeContext, setActiveContext] = useState<ErrorContext>("amm");
  const refreshKey = phase.kind === "done" ? phase.hash : 0;

  useEffect(() => {
    if (!cfg.contracts.orderbook?.trim()) {
      setFees(null);
      return;
    }
    let cancelled = false;
    setReadError(null);
    Promise.all([
      client.getMarket(cfg.marketId),
      client.getTokenizerFeeConfig(),
      client.getOrderbookConfig(),
    ])
      .then(([market, tokenizer, orderbook]) => {
        if (cancelled) return;
        const next = {
          swapAdmin: market.admin,
          swapFeeBps: market.feeBps,
          yieldAdmin: tokenizer.admin,
          yieldFeeBps: tokenizer.yieldFeeBps,
          orderbookAdmin: orderbook.admin,
          orderbookFeeBps: orderbook.takerFeeBps,
        };
        setFees(next);
        setSwapFee(next.swapFeeBps.toString());
        setYieldFee(next.yieldFeeBps.toString());
        setOrderbookFee(next.orderbookFeeBps.toString());
      })
      .catch((error) => !cancelled && setReadError(error));
    return () => {
      cancelled = true;
    };
  }, [cfg, client, refreshKey]);

  if (!cfg.contracts.orderbook?.trim()) {
    return (
      <section className="panel mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold text-ink">Protocol administration</h1>
        <p className="mt-4 text-[14px] leading-7 text-smoke">
          This legacy deployment does not advertise mutable-fee contracts. No admin transactions
          are offered, preventing the UI from calling setters that are absent from deployed Wasm.
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Protocol administration</h1>
        <p className="mt-2 text-[14px] leading-7 text-smoke">
          Fee changes are authorized independently by each contract. The connected wallet must
          exactly match the admin stored on-chain; the frontend cannot bypass that check.
        </p>
      </header>

      {readError ? (
        <p className="panel p-5 text-[13px] text-red-400">
          {readError instanceof Error ? readError.message : "Unable to read fee configuration."}
        </p>
      ) : null}
      {!fees && !readError ? <p className="panel p-5 text-[13px] text-smoke">Reading contract admins…</p> : null}

      {fees ? (
        <div className="grid gap-5 md:grid-cols-3">
          <FeeCard
            title="AMM swap fee"
            current={fees.swapFeeBps}
            maximum={9_999n}
            admin={fees.swapAdmin}
            address={address}
            value={swapFee}
            setValue={setSwapFee}
            phase={phase}
            onSubmit={(feeBps) => {
              setActiveContext("amm");
              void submit(() => client.buildSetSwapFee({ admin: address!, feeBps }));
            }}
          />
          <FeeCard
            title="Claimed-yield fee"
            current={fees.yieldFeeBps}
            maximum={2_000n}
            admin={fees.yieldAdmin}
            address={address}
            value={yieldFee}
            setValue={setYieldFee}
            phase={phase}
            onSubmit={(feeBps) => {
              setActiveContext("tokenizer");
              void submit(() => client.buildSetYieldFee({ admin: address!, feeBps }));
            }}
          />
          <FeeCard
            title="Order taker fee"
            current={fees.orderbookFeeBps}
            maximum={1_000n}
            admin={fees.orderbookAdmin}
            address={address}
            value={orderbookFee}
            setValue={setOrderbookFee}
            phase={phase}
            onSubmit={(feeBps) => {
              setActiveContext("orderbook");
              void submit(() => client.buildSetOrderbookFee({ admin: address!, feeBps }));
            }}
          />
        </div>
      ) : null}
      <TxStatus phase={phase} context={activeContext} />
    </div>
  );
}

function FeeCard({
  title,
  current,
  maximum,
  admin,
  address,
  value,
  setValue,
  phase,
  onSubmit,
}: {
  title: string;
  current: bigint;
  maximum: bigint;
  admin: string;
  address: string | null;
  value: string;
  setValue: (value: string) => void;
  phase: ReturnType<typeof useToMaker>["phase"];
  onSubmit: (feeBps: bigint) => void;
}) {
  let parsed: bigint | null = null;
  if (/^\d+$/.test(value)) parsed = BigInt(value);
  const authorized = address !== null && address === admin;
  const error =
    value !== "" && parsed === null
      ? "Enter whole basis points."
      : parsed !== null && parsed > maximum
        ? `Maximum ${maximum.toString()} bps.`
        : null;
  const disabled =
    !authorized ||
    parsed === null ||
    parsed === current ||
    parsed > maximum ||
    phase.kind === "working";

  return (
    <section className="panel space-y-4 p-6">
      <div>
        <h2 className="label-data">{title}</h2>
        <p className="mt-3 font-mono text-2xl font-semibold text-ink">{bpsToPercent(current)}</p>
        <p className="mt-2 text-[12px] text-ash">Admin: {shortAddress(admin)}</p>
      </div>
      
      <div className="space-y-2 border-t border-ink/10 pt-4">
        <label htmlFor={`fee-${title}`} className="flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-[0.08em] text-smoke">New fee</span>
          <span className="text-[11px] text-ash">basis points (bps)</span>
        </label>
        <input
          id={`fee-${title}`}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0"
          className={`field w-full font-mono ${error ? "border-red-400/50" : ""}`}
          disabled={!authorized}
        />
        {error && <p className="text-[12px] text-red-400">{error}</p>}
        {!authorized && address && (
          <p className="text-[12px] leading-5 text-ash">This wallet is not the admin for this contract.</p>
        )}
        {parsed !== null && parsed === current && (
          <p className="text-[12px] text-ash">Fee is already set to {bpsToPercent(parsed)}.</p>
        )}
      </div>

      <SubmitButton
        phase={phase}
        address={address}
        idleLabel={`Update to ${parsed !== null ? bpsToPercent(parsed) : "…"}`}
        connectLabel="Connect admin wallet"
        disabled={disabled}
        onClick={() => parsed !== null && onSubmit(parsed)}
      />
    </section>
  );
}
