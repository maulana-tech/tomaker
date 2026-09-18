// SPDX-License-Identifier: Apache-2.0

"use client";

import { useMemo } from "react";
import { appConfig, explorerBaseFor, networkLabel } from "@/lib/config";

/**
 * Chain attribution for the footer: the network the contracts run on, with a
 * link to BOT Chain and a link to the explorer for whichever network this build
 * is configured against, so the explorer link always matches the addresses the
 * app is actually using.
 */
export function BotChainBadge({ className = "" }: { className?: string }) {
  const cfg = useMemo(() => appConfig(), []);
  const explorer = explorerBaseFor(cfg.network);

  return (
    <span className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="label-data">Built on</span>
      <a
        href="https://botchain.ai"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink transition hover:text-signal-ink"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden fill="none">
          <rect x="2.2" y="4.2" width="11.6" height="8.6" rx="2.4" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="6" cy="8.5" r="1.05" fill="currentColor" />
          <circle cx="10" cy="8.5" r="1.05" fill="currentColor" />
          <path d="M8 1.6v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        BOT Chain
      </a>
      <span aria-hidden className="text-ash">·</span>
      <a
        href={explorer}
        target="_blank"
        rel="noreferrer"
        className="label-data transition hover:text-signal-ink"
      >
        Explorer ({networkLabel(cfg.network, "lower")})
      </a>
    </span>
  );
}
