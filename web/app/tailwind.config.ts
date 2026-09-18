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
// Display type carries one weight step more than it did on the dark stage.
// Light-on-dark blooms and holds a 300 weight; dark-on-light does the opposite
// and thins out, so the same headline at 300 reads spindly on paper.
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
        // Greys are tuned for contrast against paper, not against ink. They
        // clear WCAG AA (4.5:1) on #FFFFFF with headroom to spare, because most
        // of this copy sits over a scrim rather than over pure white, and the
        // scrim costs some of the ratio back.
        ash: "#5F5F5F",
        smoke: "#565656",
        pewter: "#5F5F5F",
        graphite: "#3D3D3D",
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
