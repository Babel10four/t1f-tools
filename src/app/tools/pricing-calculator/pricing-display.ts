import type { DealAnalyzePricingOutV1 } from "@/lib/engines/deal/schemas/canonical-response";

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
      return `${v}%`;
    case "marginBps":
      return `${v} bps`;
    case "discountPoints":
      return String(v);
    case "lockDays":
      return String(v);
  }
}
