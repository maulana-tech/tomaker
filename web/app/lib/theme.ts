// SPDX-License-Identifier: Apache-2.0

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "tomaker-theme";

/**
 * Resolve a stored preference into a theme, falling back to the OS setting.
 * Exported so the inline boot script and the React toggle cannot disagree
 * about what a missing or malformed value means.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

/**
 * Runs before first paint, from a blocking inline script in <head>.
 *
 * Without it the document renders once with the default theme and then
 * corrects itself on hydration, which is the white flash every dark-mode site
 * gets wrong at least once. Kept as a string so it can be inlined verbatim,
 * and deliberately tiny: it only sets a class.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var d=window.matchMedia("(prefers-color-scheme: dark)").matches;
var t=(s==="light"||s==="dark")?s:(d?"dark":"light");
if(t==="dark")document.documentElement.classList.add("dark");
}catch(e){}})();`;

/** Applies a theme to the document and remembers it. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
