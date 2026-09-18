// SPDX-License-Identifier: Apache-2.0

import type { Config } from "tailwindcss";

// "Daylight paper" monochrome design system: ink on paper, not paper on ink.
// One accent (signal-signal) that marks live/active signals only. Shape is
// binary: pill (999px) for buttons and tags, sharp (0px) for cards, inputs and
// panels. No shadows or glows; depth is tonal contrast only.
//
// `ink` and `paper` are colour names, not roles: ink is always the dark one.
// The light theme uses `bg-paper text-ink`, which is why the inversion was a
// swap of usage sites rather than of these two values.
//
// Display type carries one weight step more than a dark theme would need:
// dark-on-light thins out where light-on-dark blooms, so a 300 headline reads
// spindly on paper.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Every colour resolves through a CSS variable, so the palette has one
        // definition. Values live in globals.css.
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        // Raised panel on paper.
        chalk: "rgb(var(--paper-raised) / <alpha-value>)",
        // Secondary type, tuned to clear WCAG AA against the page in BOTH
        // themes, with headroom because most of this copy sits over a scrim
        // rather than over the flat page and the scrim costs some ratio back.
        ash: "rgb(var(--ash) / <alpha-value>)",
        smoke: "rgb(var(--smoke) / <alpha-value>)",
        pewter: "rgb(var(--pewter) / <alpha-value>)",
        graphite: "rgb(var(--graphite) / <alpha-value>)",
        // The single accent, in two values. `signal` is the brand blue and is
        // for marks, fills and rules; `signal-ink` is the only one allowed to
        // carry a word. See globals.css for why.
        signal: "rgb(var(--signal) / <alpha-value>)",
        "signal-ink": "rgb(var(--signal-ink) / <alpha-value>)",
      },
      fontFamily: {
        // Inter everywhere, wired through next/font's CSS variable.
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        // Binary radius only: sharp panels, pill controls.
        none: "0px",
        pill: "999px",
      },
      keyframes: {
        // Slow "mercury flow" ambient drift for the marketing hero render only.
        "mercury-drift": {
          "0%, 100%": { transform: "scale(1.14) translate3d(0, 0, 0)" },
          "33%": { transform: "scale(1.2) translate3d(2.5%, -2%, 0)" },
          "66%": { transform: "scale(1.18) translate3d(-2%, 1.5%, 0)" },
        },
        // Drifting specular highlight for the frosted "liquid glass" sheen.
        "glass-sheen": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)", opacity: "0.55" },
          "50%": { transform: "translate3d(5%, 4%, 0)", opacity: "1" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "mercury-drift": "mercury-drift 20s ease-in-out infinite",
        "glass-sheen": "glass-sheen 14s ease-in-out infinite",
        "spin-slow": "spin-slow 18s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
