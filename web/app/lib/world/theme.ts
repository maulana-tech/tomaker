// SPDX-License-Identifier: Apache-2.0

/**
 * The bridge between the CSS token layer and the scene.
 *
 * Three.js takes colours as integers, the design tokens are CSS custom
 * properties written as `"r g b"` channels, and the theme can change at
 * runtime. Everything in `lib/world` that needs a colour asks here, at build
 * time rather than at import time — a module-level constant would freeze
 * whatever the theme happened to be when the bundle first evaluated.
 */
export function themeColor(token: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const [r, g, b] = raw.split(/[\s,]+/).map(Number);
  if (![r, g, b].every((n) => typeof n === "number" && Number.isFinite(n))) return fallback;
  return ((r! & 255) << 16) | ((g! & 255) << 8) | (b! & 255);
}

/** The page colour. The scene dissolves into it at distance. */
export function paperColor(): number {
  return themeColor("--paper", 0xfaf7f0);
}

/** The readable dark: the principal body and the engraved graduations. */
export function inkColor(): number {
  return themeColor("--ink", 0x151310);
}

/** The single accent. The yield leg, and nothing else. */
export function signalColor(): number {
  return themeColor("--signal", 0x5ea6e5);
}

/** A plain numeric token, for the lighting scalars. */
export function themeNumber(token: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const value = Number(raw);
  return Number.isFinite(value) && raw !== "" ? value : fallback;
}

/** Brushed steel rings and armature. */
export function ringColor(): number {
  return themeColor("--world-ring", 0x3a4048);
}

/** Matte graphite castings. */
export function housingColor(): number {
  return themeColor("--world-housing", 0x1d1f23);
}

/**
 * What a material is for, so a theme change can find it again.
 *
 * Rebuilding the scene would be the obvious way to recolour it, but the world
 * spans two canvases and one of them is owned by the layout, not by this
 * component — a second WebGLRenderer on that element gets a null context and
 * throws inside Three. Tagging is what makes recolouring in place possible.
 */
export type MaterialRole = "ring" | "housing" | "ink" | "signal";

type Themed = { userData: Record<string, unknown>; color?: { set(value: number): void } };

export function tagRole<T extends Themed>(material: T, role: MaterialRole): T {
  material.userData.themeRole = role;
  return material;
}

const ROLE_COLOR: Record<MaterialRole, () => number> = {
  ring: ringColor,
  housing: housingColor,
  ink: inkColor,
  signal: signalColor,
};

/** Re-reads the tokens and repaints every tagged material under `root`. */
export function applyThemeToMaterials(root: {
  traverse(fn: (node: unknown) => void): void;
}): void {
  root.traverse((node) => {
    const mesh = node as { material?: Themed | Themed[] };
    const list = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of list) {
      const role = material.userData?.themeRole as MaterialRole | undefined;
      if (role && material.color) material.color.set(ROLE_COLOR[role]());
    }
  });
}
