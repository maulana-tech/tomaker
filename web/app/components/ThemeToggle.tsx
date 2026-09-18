// SPDX-License-Identifier: Apache-2.0

"use client";

import { useCallback, useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

/**
 * Light/dark switch.
 *
 * The document class is set before paint by the boot script, so this reads the
 * class rather than storage and cannot disagree with what is on screen. It
 * renders the same markup on the server and on first client paint, then syncs
 * in an effect, which keeps hydration quiet.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => setTheme(currentTheme()), []);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    // The WebGL scene samples the tokens when it builds its materials, so a
    // flip has to tell it to re-read them. Dispatched outside the state
    // updater: an updater has to stay pure, and doing it inside fired another
    // component's setState mid-render.
    window.dispatchEvent(new CustomEvent("tomaker:themechange", { detail: next }));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-pill border border-ink/15 text-ink transition hover:border-ink/40 ${className}`}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none">
        {theme === "dark" ? (
          <path
            d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z"
            fill="currentColor"
          />
        ) : (
          <>
            <circle cx="8" cy="8" r="3.1" fill="currentColor" />
            <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1M12.9 12.9l-1.1-1.1M4.2 4.2 3.1 3.1" />
            </g>
          </>
        )}
      </svg>
    </button>
  );
}
