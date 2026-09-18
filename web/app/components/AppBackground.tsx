// SPDX-License-Identifier: Apache-2.0

// The canvas behind the working app screens. This used to be a dark chrome
// render dimmed by an ink wash, which read as atmosphere on a black stage.
// Under a paper wash the same render is grey smear across the data, so the
// canvas is plain paper now, with one very faint sheen for depth. Fixed, so
// content scrolls over it.
export function AppBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-paper">
      <div className="absolute inset-0 animate-glass-sheen bg-[radial-gradient(120%_80%_at_70%_8%,rgba(0,0,0,0.035),transparent_55%)]" />
    </div>
  );
}
