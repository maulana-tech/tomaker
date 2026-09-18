// SPDX-License-Identifier: Apache-2.0

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";

const TITLE = "toMaker, split, fix, and trade tokenized-bond yield";
const DESCRIPTION =
  "Separate principal and yield exposure for a tokenized bond on BOT Chain. Trade PT and YT through an AMM and PT/SY order book.";

// metadataBase resolves the icon and opengraph-image file conventions in
// app/ to absolute URLs, which is what link unfurlers require.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.tomaker.tech"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "toMaker",
    url: "https://www.tomaker.tech",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// The root layout only owns the document shell and wallet context. The
// marketing surface and the working app each provide their own chrome via
// route-group layouts, so the landing page is not boxed into the app frame.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* HarmonyOS Sans SC, split into unicode-range subsets. Pinned to an
            exact version so a CDN release cannot change the type under us. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/harmonyos-sans-sc-webfont-splitted@1.1.0/dist/index.css"
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink">
        <WalletProvider>{children}</WalletProvider>
        {/* @vercel/analytics serves /_vercel/insights/script.js, which only
            exists on Vercel. Loading it on the Cloudflare Worker build 404s. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
