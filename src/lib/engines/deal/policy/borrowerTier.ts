/**
 * Tier 1 / 2 borrowers use the bridge advance rule (90% of purchase + 100% of rehab,
 * subject to ARV cap) — see `purchaseMax.ts`.
 */
export function isBorrowerTier1Or2(experienceTier: string | undefined): boolean {
  if (experienceTier === undefined) {
    return false;
  }
  const t = experienceTier.trim().toLowerCase();
  if (t === "1" || t === "2") {
    return true;
  }
  const m = /^tier\s*([12])$/.exec(t);
  return m !== null;
}
