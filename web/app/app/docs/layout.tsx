// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { Grain } from "@/components/Grain";
import { DocsSidebar } from "@/components/DocsSidebar";
import { BotChainBadge } from "@/components/BotChainBadge";

export const metadata: Metadata = {
  title: {
    template: "%s · toMaker Docs",
    default: "Documentation · toMaker",
  },
  description:
    "How toMaker splits yield-bearing positions on BOT Chain into principal and yield tokens: concepts, protocol design, guides, and contract reference.",
};

// Docs chrome: the marketing route's star-chart atmosphere (gradient sky,
// star speckle, chart rings, nebulae) fixed at z-0, with the reading surface
// at z-10 above it. A quiet persistent top bar and a sticky section rail
// carry the navigation; the content column is capped for measure.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Paper, not the dither field. The field belongs to the marketing pages;
       docs is long-form reading and a two-tone pattern under a column of body
       copy costs more legibility than it buys. */
    <div className="relative flex min-h-screen flex-col bg-paper text-ink">
      <Grain className="fixed inset-0 z-0" />

      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="toMaker home">
              <Wordmark />
            </Link>
            <span className="hidden border-l border-ink/15 pl-4 label-data sm:inline">Docs</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/maulana-techtomaker"
              className="label-data transition hover:text-ink"
            >
              GitHub
            </a>
            <Link
              href="/mint"
              className="rounded-pill bg-ink px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-smoke"
            >
              Open App
            </Link>
          </div>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-0 px-6 lg:flex-row lg:gap-12">
        <DocsSidebar />
        <main className="min-w-0 max-w-3xl flex-1 py-10 lg:py-14">{children}</main>
      </div>

      <footer className="relative z-10 border-t border-ink/10 bg-paper/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-3 px-6 py-8 sm:flex-row sm:items-center">
          <p className="label-data">© 2026 toMaker Protocol</p>
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/" className="label-data transition hover:text-ink">
              Home
            </Link>
            <a
              href="https://github.com/maulana-techtomaker"
              className="label-data transition hover:text-ink"
            >
              GitHub
            </a>
            <BotChainBadge />
          </div>
        </div>
      </footer>
    </div>
  );
}
