// SPDX-License-Identifier: Apache-2.0

"use client";

import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import type { OrderSide, PlaceOrderArgs, RestingOrder, TransactionRequest } from "@tomaker/sdk";
import {
  amountError,
  bpsToPercent,
  fmt,
  parseTokenAmount,
  shortAddress,
} from "@/lib/format";
import { ensureAllowance } from "@/lib/sdk";
import { useToMaker } from "@/lib/useToMaker";
import { useMarketStatus } from "@/lib/useMarket";
import { usePosition } from "@/lib/usePosition";
import {
  formatPriceWad,
  predecessorFor,
  quoteForBase,
  summarizeBook,
  useOrderBook,
} from "@/lib/useOrderBook";
import { MaturityBadge } from "@/components/MaturityBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { TxStatus } from "@/components/TxStatus";

const EXPIRIES = [
  { label: "1 hour", seconds: 60 * 60 },
  { label: "1 day", seconds: 24 * 60 * 60 },
  { label: "7 days", seconds: 7 * 24 * 60 * 60 },
  { label: "30 days", seconds: 30 * 24 * 60 * 60 },
] as const;

export default function OrderBookPage() {
  const { cfg, client, address, phase, submitSequence } = useToMaker();
  const refreshKey = phase.kind === "done" ? phase.hash : 0;
  const { market } = useMarketStatus(refreshKey);
  const position = usePosition(address, refreshKey);
  const book = useOrderBook(refreshKey);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [placementSide, setPlacementSide] = useState<OrderSide>("Ask");
  const [placementAmount, setPlacementAmount] = useState("");
  const [placementPrice, setPlacementPrice] = useState("");
  const [expirySeconds, setExpirySeconds] = useState(EXPIRIES[1].seconds);
  const [fillAmount, setFillAmount] = useState("");

  const allOrders = useMemo(() => [...book.asks, ...book.bids], [book.asks, book.bids]);
  const selected = allOrders.find((order) => order.id === selectedId) ?? null;
  const { midWad, spreadBps } = summarizeBook(book.asks, book.bids);

  if (!book.available) {
    return (
      <div className="space-y-12">
        <Header maturity={market?.maturity ?? null} />
        <section className="card px-6 py-10 text-center">
          <h2 className="text-lg font-medium text-ink">Resting orders are not deployed here</h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-7 text-smoke">
            This is a legacy market with only the AMM. Configure a V2 deployment&apos;s
            NEXT_PUBLIC_ORDERBOOK_ADDRESS to enable escrowed limit orders.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <Header maturity={market?.maturity ?? null} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card overflow-hidden">
          <BookHeader
            midWad={midWad}
            spreadBps={spreadBps}
            feeBps={book.config?.takerFeeBps ?? null}
            onRefresh={book.refresh}
          />
          {book.loading ? (
            <LadderSkeleton />
          ) : book.error ? (
            <p className="px-6 py-10 text-center text-[14px] text-red-700">
              {book.error instanceof Error ? book.error.message : "Unable to read resting orders."}
            </p>
          ) : (
            <>
              <BookRows
                orders={book.asks}
                side="Ask"
                decimals={cfg.decimals}
                selectedId={selectedId}
                onSelect={(order) => {
                  setSelectedId(order.id);
                  setFillAmount(formatUnits(order.remainingBase, cfg.decimals));
                }}
              />
              <InsideMarket midWad={midWad} spreadBps={spreadBps} />
              <BookRows
                orders={book.bids}
                side="Bid"
                decimals={cfg.decimals}
                selectedId={selectedId}
                onSelect={(order) => {
                  setSelectedId(order.id);
                  setFillAmount(formatUnits(order.remainingBase, cfg.decimals));
                }}
              />
            </>
          )}
        </section>

        <div className="space-y-6">
          <PlaceOrderPanel
            side={placementSide}
            setSide={setPlacementSide}
            amount={placementAmount}
            setAmount={setPlacementAmount}
            price={placementPrice}
            setPrice={setPlacementPrice}
            expirySeconds={expirySeconds}
            setExpirySeconds={setExpirySeconds}
            orders={placementSide === "Ask" ? book.asks : book.bids}
            oppositeBest={placementSide === "Ask" ? book.bids[0] ?? null : book.asks[0] ?? null}
            maturity={book.config?.maturity ?? null}
            decimals={cfg.decimals}
            position={position}
            address={address}
            phase={phase}
            onSubmit={(args) => {
              void (async () => {
                if (!address) return;
                const token = args.side === "Ask" ? cfg.contracts.pt : cfg.contracts.sy;
                const needed =
                  args.side === "Ask" ? args.baseAmount : quoteForBase(args.baseAmount, args.priceWad);
                const steps: {
                  label: string;
                  build: () => TransactionRequest | Promise<TransactionRequest>;
                }[] = [];
                const approve = await ensureAllowance(
                  client,
                  token,
                  address,
                  cfg.contracts.orderbook!,
                  needed,
                );
                if (approve) steps.push({ label: "Approve", build: async () => approve });
                steps.push({ label: "Place order", build: () => client.buildPlaceOrder(args) });
                await submitSequence(steps);
              })();
            }}
          />

          <OrderDetail
            order={selected}
            isBest={
              selected !== null &&
              (selected.side === "Ask" ? book.asks[0]?.id : book.bids[0]?.id) === selected.id
            }
            amount={fillAmount}
            setAmount={setFillAmount}
            feeBps={book.config?.takerFeeBps ?? 0n}
            decimals={cfg.decimals}
            position={position}
            address={address}
            phase={phase}
            onFill={(order, amount) => {
              void (async () => {
                if (!address) return;
                const feeBps = book.config?.takerFeeBps ?? 0n;
                const quote = quoteForBase(amount, order.priceWad);
                const fee = (quote * feeBps) / 10_000n;
                const token = order.side === "Ask" ? cfg.contracts.sy : cfg.contracts.pt;
                const needed = order.side === "Ask" ? quote + fee : amount;
                const steps: {
                  label: string;
                  build: () => TransactionRequest | Promise<TransactionRequest>;
                }[] = [];
                const approve = await ensureAllowance(
                  client,
                  token,
                  address,
                  cfg.contracts.orderbook!,
                  needed,
                );
                if (approve) steps.push({ label: "Approve", build: async () => approve });
                steps.push({
                  label: "Fill order",
                  build: () =>
                    client.buildFillBestOrder({
                      taker: address,
                      restingSide: order.side,
                      baseAmount: amount,
                      limitPriceWad: order.priceWad,
                    }),
                });
                await submitSequence(steps);
              })();
            }}
            onCancel={(order) =>
              submitSequence([
                {
                  label: "Cancel order",
                  build: () => client.buildCancelOrder({ maker: address!, orderId: order.id }),
                },
              ])
            }
          />
          <TxStatus phase={phase} context="orderbook" />
        </div>
      </div>
    </div>
  );
}

function Header({ maturity }: { maturity: number | null }) {
  return (
    <header className="space-y-3">
      <h1 className="text-6xl font-normal tracking-tight sm:text-7xl">Order book</h1>
      <p className="max-w-xl text-smoke">
        Escrowed PT/SY limit orders with on-chain price-time priority, partial fills,
        cancellation and expiry. Prices are SY shares per PT.
      </p>
      <MaturityBadge maturity={maturity} />
    </header>
  );
}

function BookHeader({
  midWad,
  spreadBps,
  feeBps,
  onRefresh,
}: {
  midWad: bigint | null;
  spreadBps: bigint | null;
  feeBps: bigint | null;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 px-6 py-5">
      <div className="flex flex-wrap gap-8">
        <div>
          <p className="label-data">Mid price</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-ink">
            {midWad === null ? "—" : formatPriceWad(midWad)}
          </p>
        </div>
        <div>
          <p className="label-data">Spread</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-ink">
            {spreadBps === null ? "—" : bpsToPercent(spreadBps)}
          </p>
        </div>
        <div>
          <p className="label-data">Taker fee</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-ink">
            {feeBps === null ? "—" : bpsToPercent(feeBps)}
          </p>
        </div>
      </div>
      <button
        type="button"
        className="rounded-pill border border-ink/15 px-3 py-1.5 text-[13px] uppercase tracking-[0.1em] text-smoke transition hover:border-ink hover:text-ink"
        onClick={onRefresh}
      >
        Refresh
      </button>
    </div>
  );
}

function BookRows({
  orders,
  side,
  decimals,
  selectedId,
  onSelect,
}: {
  orders: RestingOrder[];
  side: OrderSide;
  decimals: number;
  selectedId: bigint | null;
  onSelect: (order: RestingOrder) => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-[13px] text-smoke">No resting {side.toLowerCase()}s.</p>
        <p className="mt-1 text-[12px] text-ash">Be the first to place a {side.toLowerCase()} order.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-3 border-t border-ink/10 px-6 py-2 text-[11px] uppercase tracking-[0.12em] text-ash">
        <span>ID</span>
        <span>PT remaining</span>
        <span className="text-right">Price (SY/PT)</span>
        <span className="text-right">Maker</span>
      </div>
      <ol className={side === "Ask" ? "flex flex-col-reverse" : ""}>
        {orders.map((order) => (
          <li key={order.id.toString()}>
            <button
              type="button"
              aria-pressed={selectedId === order.id}
              onClick={() => onSelect(order)}
              className={`grid w-full grid-cols-[60px_1fr_1fr_1fr] gap-3 border-l-2 border-t border-t-ink/5 px-6 py-3 text-left transition ${
                selectedId === order.id
                  ? "border-l-signal bg-ink/[0.05]"
                  : "border-l-transparent hover:bg-ink/[0.03]"
              }`}
            >
              <span className={`font-mono text-[13px] ${side === "Ask" ? "text-red-700" : "text-emerald-700"}`}>
                #{order.id.toString()}
              </span>
              <span className="font-mono text-[13px] tabular-nums text-smoke">
                {fmt(order.remainingBase, decimals, 4)}
              </span>
              <span className="text-right font-mono text-[13px] tabular-nums text-ink">
                {formatPriceWad(order.priceWad)}
              </span>
              <span className="text-right font-mono text-[12px] text-ash">
                {shortAddress(order.maker, 4)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function InsideMarket({ midWad, spreadBps }: { midWad: bigint | null; spreadBps: bigint | null }) {
  return (
    <div className="flex items-center justify-between border-y border-ink/10 bg-ink/[0.03] px-6 py-3">
      <span className="label-data">Inside market</span>
      <div className="flex items-center gap-4">
        <span className="font-mono text-[14px] text-signal-ink">
          {midWad === null ? "—" : formatPriceWad(midWad)}
        </span>
        <span className="rounded-pill border border-ink/10 px-2.5 py-0.5 font-mono text-[12px] text-ash">
          {spreadBps === null ? "One-sided" : `${bpsToPercent(spreadBps)} spread`}
        </span>
      </div>
    </div>
  );
}

type PositionLike = { ptBalance: bigint; syBalance: bigint } | null;
type Phase = ReturnType<typeof useToMaker>["phase"];

function PlaceOrderPanel({
  side,
  setSide,
  amount,
  setAmount,
  price,
  setPrice,
  expirySeconds,
  setExpirySeconds,
  orders,
  oppositeBest,
  maturity,
  decimals,
  position,
  address,
  phase,
  onSubmit,
}: {
  side: OrderSide;
  setSide: (side: OrderSide) => void;
  amount: string;
  setAmount: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
  expirySeconds: number;
  setExpirySeconds: (value: number) => void;
  orders: RestingOrder[];
  oppositeBest: RestingOrder | null;
  maturity: bigint | null;
  decimals: number;
  position: PositionLike;
  address: string | null;
  phase: Phase;
  onSubmit: (args: PlaceOrderArgs) => void;
}) {
  let baseAmount: bigint | null = null;
  let priceWad: bigint | null = null;
  try {
    baseAmount = amount ? parseTokenAmount(amount, decimals) : null;
    priceWad = price ? parseTokenAmount(price, 18) : null;
  } catch {
    // Validation copy is derived below.
  }
  const quote = baseAmount && priceWad ? quoteForBase(baseAmount, priceWad) : 0n;
  const max = side === "Ask" ? position?.ptBalance : position?.syBalance;
  const balanceError = amountError(amount, decimals, side === "Ask" ? max ?? undefined : undefined);
  const bidBalanceError = side === "Bid" && max !== undefined && quote > max ? "Order exceeds your SY balance." : null;
  const crosses =
    priceWad !== null &&
    oppositeBest !== null &&
    (side === "Ask" ? priceWad <= oppositeBest.priceWad : priceWad >= oppositeBest.priceWad);
  const live = maturity !== null && maturity > BigInt(Math.floor(Date.now() / 1000));
  const validation =
    balanceError ??
    bidBalanceError ??
    (price !== "" && priceWad === null ? "Enter a valid price with at most 18 decimals." : null) ??
    (priceWad !== null && priceWad <= 0n ? "Price must be greater than zero." : null) ??
    (crosses ? "This price crosses the book. Select and fill the best resting order instead." : null) ??
    (!live ? "This market has matured; new orders are closed." : null);
  const canSubmit =
    address !== null &&
    baseAmount !== null &&
    baseAmount > 0n &&
    priceWad !== null &&
    priceWad > 0n &&
    live &&
    position !== null &&
    !validation &&
    phase.kind !== "working";

  return (
    <section className="card space-y-5 p-8">
      <h2 className="text-lg font-semibold text-ink">Place resting order</h2>

      <div className="grid grid-cols-2 gap-1 rounded-pill border border-ink/10 p-1">
        {(["Ask", "Bid"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={side === value}
            onClick={() => setSide(value)}
            className={`rounded-pill px-3 py-2 text-[13px] uppercase tracking-[0.08em] transition ${
              side === value
                ? value === "Ask"
                  ? "bg-red-700 text-paper"
                  : "bg-emerald-700 text-paper"
                : "text-smoke hover:text-ink"
            }`}
          >
            {value === "Ask" ? "Sell PT" : "Buy PT"}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="flex items-center justify-between">
          <span className="label-data">PT amount</span>
          {max !== undefined && (
            <button
              type="button"
              className="font-mono text-[12px] text-smoke transition hover:text-ink"
              onClick={() => setAmount(formatUnits(max, decimals))}
            >
              Max {fmt(max, decimals, 4)}
            </button>
          )}
        </span>
        <input
          className="field"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </label>

      <label className="block">
        <span className="label-data">Limit price · SY per PT</span>
        <input
          className="field"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0.95000"
        />
      </label>

      <label className="block">
        <span className="label-data">Expiry</span>
        <select
          className="field text-base"
          value={expirySeconds}
          onChange={(event) => setExpirySeconds(Number(event.target.value))}
        >
          {EXPIRIES.map((option) => (
            <option key={option.seconds} value={option.seconds}>{option.label}</option>
          ))}
        </select>
      </label>

      <dl className="panel-subtle space-y-2 p-4">
        <DetailRow
          label={side === "Ask" ? "Expected proceeds" : "SY required"}
          value={`${fmt(quote, decimals, 4)} SY`}
        />
        <DetailRow
          label="Predecessor"
          value={priceWad ? `#${predecessorFor(orders, side, priceWad)?.toString() ?? "head"}` : "—"}
        />
      </dl>

      {validation && (
        <p className="border border-red-700/20 bg-red-700/5 px-4 py-3 text-[13px] text-red-700">{validation}</p>
      )}

      <SubmitButton
        phase={phase}
        address={address}
        idleLabel={side === "Ask" ? "Place PT ask" : "Place PT bid"}
        connectLabel="Connect wallet to place"
        disabled={!canSubmit}
        onClick={() => {
          if (!address || baseAmount === null || priceWad === null || maturity === null) return;
          const now = BigInt(Math.floor(Date.now() / 1000));
          const expiry = now + BigInt(expirySeconds) < maturity ? now + BigInt(expirySeconds) : maturity;
          onSubmit({ maker: address, side, baseAmount, priceWad, expiry, predecessor: predecessorFor(orders, side, priceWad) });
        }}
      />
    </section>
  );
}

function OrderDetail({
  order,
  isBest,
  amount,
  setAmount,
  feeBps,
  decimals,
  position,
  address,
  phase,
  onFill,
  onCancel,
}: {
  order: RestingOrder | null;
  isBest: boolean;
  amount: string;
  setAmount: (value: string) => void;
  feeBps: bigint;
  decimals: number;
  position: PositionLike;
  address: string | null;
  phase: Phase;
  onFill: (order: RestingOrder, amount: bigint) => void;
  onCancel: (order: RestingOrder) => void;
}) {
  if (!order) {
    return <section className="card border-dashed p-8 text-center text-[13px] leading-6 text-ash">Select a resting order in the book to fill it or inspect its escrow.</section>;
  }
  let baseAmount: bigint | null = null;
  try {
    baseAmount = amount ? parseTokenAmount(amount, decimals) : null;
  } catch {
    // Error copy below.
  }
  const quote = baseAmount ? quoteForBase(baseAmount, order.priceWad) : 0n;
  const fee = (quote * feeBps) / 10_000n;
  const maxTakerBalance = order.side === "Ask" ? position?.syBalance : position?.ptBalance;
  const required = order.side === "Ask" ? quote + fee : baseAmount ?? 0n;
  const validation =
    amountError(amount, decimals, order.remainingBase) ??
    (maxTakerBalance !== undefined && required > maxTakerBalance ? "Fill exceeds your wallet balance." : null) ??
    (!isBest ? "Only the best-priced order can fill; this enforces price-time priority." : null);
  const canFill = address !== null && baseAmount !== null && baseAmount > 0n && !validation && phase.kind !== "working";
  const makerOwns = address === order.maker;

  return (
    <section className="card p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Order #{order.id.toString()}</h2>
        <span
          className={`rounded-pill border px-2.5 py-0.5 text-[12px] uppercase tracking-[0.1em] ${
            order.side === "Ask" ? "border-red-700/30 text-red-700" : "border-emerald-700/30 text-emerald-700"
          }`}
        >
          {order.side}
        </span>
      </div>
      <dl className="mt-4 space-y-2">
        <DetailRow label="Maker" value={shortAddress(order.maker)} />
        <DetailRow label="Price" value={`${formatPriceWad(order.priceWad)} SY`} />
        <DetailRow label="Remaining" value={`${fmt(order.remainingBase, decimals, 4)} PT`} />
        <DetailRow label="Escrow" value={`${fmt(order.escrowRemaining, decimals, 4)} ${order.side === "Ask" ? "PT" : "SY"}`} />
        <DetailRow label="Expires" value={new Date(Number(order.expiry) * 1000).toLocaleString()} />
      </dl>
      <label className="mt-6 block">
        <span className="label-data">PT to fill</span>
        <input className="field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <dl className="panel-subtle mt-4 space-y-2 p-4">
        <DetailRow label={order.side === "Ask" ? "You pay" : "You receive gross"} value={`${fmt(quote, decimals, 4)} SY`} />
        <DetailRow label="Taker fee" value={`${fmt(fee, decimals, 4)} SY`} />
      </dl>
      {validation ? <p className="mt-3 text-[13px] leading-5 text-red-700">{validation}</p> : null}
      <div className="mt-5 space-y-3">
        <SubmitButton
          phase={phase}
          address={address}
          idleLabel={order.side === "Ask" ? "Buy resting PT" : "Sell into bid"}
          connectLabel="Connect wallet to fill"
          disabled={!canFill}
          onClick={() => baseAmount !== null && onFill(order, baseAmount)}
        />
        {makerOwns ? (
          <button type="button" className="btn-ghost w-full" disabled={phase.kind === "working"} onClick={() => onCancel(order)}>
            Cancel and return escrow
          </button>
        ) : null}
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-ash">{label}</dt>
      <dd className="text-right font-mono text-[13px] tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function LadderSkeleton() {
  return (
    <div className="divide-y divide-ink/5">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between px-6 py-3">
          <span className="h-3 w-24 animate-pulse bg-ink/10" />
          <span className="h-3 w-20 animate-pulse bg-ink/10" />
          <span className="h-3 w-16 animate-pulse bg-ink/10" />
        </div>
      ))}
    </div>
  );
}
