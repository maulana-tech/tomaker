// SPDX-License-Identifier: Apache-2.0

"use client";

import { appConfig } from "../lib/config";
import { explorerTxUrl } from "../lib/explorer";

/**
 * Renders a confirmed transaction hash as a link to the explorer for the
 * configured network. Used wherever an action reports a settled tx hash.
 */
export function ExplorerTxLink({ hash, className }: { hash: string; className?: string }) {
  const url = explorerTxUrl(hash, appConfig().network);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="View transaction on the explorer"
      className={`font-mono text-signal-ink underline decoration-dotted underline-offset-2 transition hover:text-ink ${className ?? ""}`}
    >
      {hash.slice(0, 10)}… ↗
    </a>
  );
}
