import type { LoanAssistantFields } from "./build-deal-analyze-request";
import {
  TIER12_INITIAL_ADVANCE_PCT,
  TIER12_REHAB_ADVANCE_PCT,
} from "@/lib/engines/deal/policy/constants";

export function parsePurchasePricePositive(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseNonNegativeMoney(s: string): number {
  const t = s.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Rounded indicative total: 90% LTC-style acquisition slice + rehab when borrower takes rehab proceeds. */
export function purchaseRequestedLoanSuggestedString(
  fields: LoanAssistantFields,
): string | null {
  const purchasePrice = parsePurchasePricePositive(fields.purchasePrice);
  if (purchasePrice === null) return null;
  const rehab = parseNonNegativeMoney(fields.rehabBudget);
  const rehabPart =
    fields.borrowingRehabFunds === "yes" ? TIER12_REHAB_ADVANCE_PCT * rehab : 0;
  const acquisitionPart = TIER12_INITIAL_ADVANCE_PCT * purchasePrice;
  return String(Math.round(acquisitionPart + rehabPart));
}
