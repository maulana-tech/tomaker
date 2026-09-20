// SPDX-License-Identifier: Apache-2.0

/**
 * Display formatting helpers. Pure functions so they are unit-testable without
 * a browser or RPC. The protocol speaks in base units (bigint) and basis
 * points; the UI speaks in human decimals and percent.
 */

/** Formats a basis-point value as a percent string, e.g. 860n -> "8.60%". */
export function bpsToPercent(bps: bigint, fractionDigits = 2): string {
  const sign = bps < 0n ? "-" : "";
  const abs = bps < 0n ? -bps : bps;
  const whole = abs / 100n;
  const frac = abs % 100n;
  if (fractionDigits === 0) {
    return `${sign}${whole}%`;
  }
  const fracStr = frac.toString().padStart(2, "0").slice(0, fractionDigits).padEnd(fractionDigits, "0");
  return `${sign}${whole}.${fracStr}%`;
}

/**
 * Formats a token amount given in base units into a decimal string.
 * e.g. (1_234_567n, 6) -> "1.234567". Trailing zeros are trimmed but at least
 * one fractional digit is kept when there is a fractional part.
 */
export function formatTokenAmount(baseUnits: bigint, decimals: number, maxFractionDigits = 6): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = abs % scale;

  let fracStr = frac.toString().padStart(decimals, "0");
  if (maxFractionDigits < decimals) {
    fracStr = fracStr.slice(0, maxFractionDigits);
  }
  fracStr = fracStr.replace(/0+$/, "");

  const sign = negative ? "-" : "";
  const wholeStr = whole.toString();
  
  // For very large whole numbers, add thousands separators
  const formattedWhole = wholeStr.length > 3
    ? wholeStr.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : wholeStr;

  return fracStr.length > 0
    ? `${sign}${formattedWhole}.${fracStr}`
    : `${sign}${formattedWhole}`;
}

/**
 * Auto-compact formatter for ALL token displays.
 * < 1,000 → full decimal (e.g. "123.45")
 * ≥ 1,000 → compact with K/M/B/T (e.g. "1.23K", "5.67M")
 */
export function fmt(baseUnits: bigint, decimals: number, maxFraction = 2): string {
  if (baseUnits === 0n) return "0";
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const asNumber = Number((abs * 10000n) / (10n ** BigInt(decimals))) / 10000;
  const sign = negative ? "-" : "";

  if (asNumber >= 1e12) return `${sign}${(asNumber / 1e12).toFixed(2)}T`;
  if (asNumber >= 1e9) return `${sign}${(asNumber / 1e9).toFixed(2)}B`;
  if (asNumber >= 1e6) return `${sign}${(asNumber / 1e6).toFixed(2)}M`;
  if (asNumber >= 1e3) return `${sign}${(asNumber / 1e3).toFixed(2)}K`;

  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = abs % scale;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracStr ? `${sign}${wholeStr}.${fracStr}` : `${sign}${wholeStr}`;
}

/**
 * Bond value as percentage of face value.
 * e.g. valueUnit=950_087_892_232, face=1_000_000_000_000 → "95.01%"
 */
export function fmtPctOfFace(valueUnit: bigint, faceValuePerUnit: bigint): string {
  if (faceValuePerUnit <= 0n) return "n/a";
  const bps = (valueUnit * 10_000n) / faceValuePerUnit;
  const pct = Number(bps) / 100;
  return `${pct.toFixed(2)}% of par`;
}

/** Parses a human decimal string into base units. Throws on malformed input. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`invalid amount: "${value}"`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`too many decimals: max ${decimals}`);
  }
  const scaled = `${whole}${frac.padEnd(decimals, "0")}`;
  return BigInt(scaled);
}

/**
 * Validates a user-entered amount. Returns an error message, or null when the
 * input is acceptable (including empty, which simply leaves the action
 * disabled). `max`, when provided, is the holder's available balance in base
 * units.
 */
export function amountError(value: string, decimals: number, max?: bigint): string | null {
  if (value.trim() === "") return null;
  let parsed: bigint;
  try {
    parsed = parseTokenAmount(value, decimals);
  } catch (err) {
    return err instanceof Error ? err.message : "invalid amount";
  }
  if (parsed <= 0n) return "Enter an amount greater than zero.";
  if (max !== undefined && parsed > max) return "Amount exceeds your balance.";
  return null;
}

/** Whole days between now and a Unix-second maturity, floored at zero. */
export function daysToMaturity(maturitySec: number, nowSec = Math.floor(Date.now() / 1000)): number {
  return Math.max(0, Math.floor((maturitySec - nowSec) / 86_400));
}

/** Formats a Unix-second maturity as a compact date for market surfaces. */
export function formatMaturityDate(maturitySec: number): string {
  return new Date(maturitySec * 1000).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Human copy for the maturity state of an on-chain market. */
export function maturityStatus(maturitySec: number, nowSec = Math.floor(Date.now() / 1000)): string {
  if (maturitySec <= nowSec) return "Matured";
  const days = daysToMaturity(maturitySec, nowSec);
  if (days === 0) return "Matures today";
  return `Matures after ${days} ${days === 1 ? "day" : "days"}`;
}

/** Compact display for EVM contract or account addresses. */
export function shortAddress(address: string, visible = 6): string {
  if (address.length <= visible * 2 + 1) return address;
  return `${address.slice(0, visible)}...${address.slice(-visible)}`;
}
