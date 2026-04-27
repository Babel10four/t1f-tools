import type { DealAnalyzePricingOutV1 } from "@/lib/engines/deal/schemas/canonical-response";

/**
 * Note rate for display — avoids rounding to 2 decimals (e.g. 9.125% not 9.13%).
 * Trims trailing zeros after up to 6 fractional digits.
 */
export function formatNoteRatePercentDisplay(v: number | null): string {
  if (v === null) {
    return "—";
  }
  const s = v.toFixed(6).replace(/\.?0+$/, "");
  return `${s}%`;
}

/** Only the four nullable scalars on `pricing` (excludes `status`). */
export function allPricingScalarsNull(p: DealAnalyzePricingOutV1): boolean {
  return (
    p.noteRatePercent === null &&
    p.marginBps === null &&
    p.discountPoints === null &&
    p.lockDays === null
  );
}

/**
 * Display-only formatting for existing contract fields — no policy inference.
 * Stable order for rows: noteRatePercent → marginBps → discountPoints → lockDays.
 */
export function formatPricingScalar(
  key: "noteRatePercent" | "marginBps" | "discountPoints" | "lockDays",
  p: DealAnalyzePricingOutV1,
): string {
  const v = p[key];
  if (v === null) {
    return "—";
  }
  switch (key) {
    case "noteRatePercent":
      return formatNoteRatePercentDisplay(v as number | null);
    case "marginBps":
      return `${v} bps`;
    case "discountPoints":
      return String(v);
    case "lockDays":
      return String(v);
  }
}
