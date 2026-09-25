// SPDX-License-Identifier: Apache-2.0

"use client";

import { useState, useRef } from "react";
import { useWallet } from "@/lib/wallet";
import { useToMaker } from "@/lib/useToMaker";
import { requestFaucetFunds } from "@/lib/faucet";

const BUTTON_CLASS = "btn-ghost w-full py-2.5 text-[13px]";

type FaucetState = "idle" | "working" | "done" | "error";

/**
 * Testnet faucet button. tUSD has no public mint, so this asks the server-side
 * `/api/faucet` route to grant KYC and transfer test cash and gas BOT. The
 * browser wallet does not sign for the faucet.
 */
export function FaucetButton({
  className,
  onDone,
}: {
  className?: string;
  onDone?: () => void;
}) {
  const { cfg, address } = useToMaker();
  const { getAccessToken } = useWallet();
  const submitting = useRef(false);
  const [state, setState] = useState<FaucetState>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!cfg.faucetEnabled) return null;

  const busy = state === "working";
  const label = !address
    ? "Connect wallet to get test cash"
    : busy
      ? "Funding wallet…"
      : state === "error"
        ? "Retry test cash"
        : state === "done"
          ? "Wallet funded ✓"
          : `Get ${cfg.faucetAmount} test cash`;

  return (
    <div>
      <button
        type="button"
        className={className ?? BUTTON_CLASS}
        disabled={busy || !address || state === "done"}
        onClick={() => {
          if (!address || submitting.current) return;
          submitting.current = true;
          void (async () => {
            setState("working");
            setError(null);
            try {
              await requestFaucetFunds(address, await getAccessToken?.());
              setState("done");
              onDone?.();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
              setState("error");
            } finally {
              submitting.current = false;
            }
          })();
        }}
        data-tour="faucet"
      >
        {busy ? (
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-pill border border-ink/20 border-t-ink"
          />
        ) : null}
        {label}
      </button>
      {error ? <p className="mt-2 text-xs leading-relaxed text-red-700">{error}</p> : null}
      {state === "done" ? (
        <p className="mt-2 text-xs text-signal-ink">
          {cfg.faucetAmount} test cash sent, KYC granted. Balance refreshes shortly.
        </p>
      ) : null}
    </div>
  );
}
