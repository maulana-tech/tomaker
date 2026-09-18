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
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        ink: "#0B0B0B",
        // Raised panel on paper. Replaces the darkroom's near-black `carbon`.
        chalk: "#F4F4F4",
        // Greys are tuned for contrast against paper, not against ink: every
        // one of these clears WCAG AA (4.5:1) on #FFFFFF as body text.
        ash: "#6D6D6D",
        smoke: "#767676",
        pewter: "#6F6F6F",
        graphite: "#4A4A4A",
        // The single accent. One job: live/active signals.
        signal: "#1CD8B0",
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
