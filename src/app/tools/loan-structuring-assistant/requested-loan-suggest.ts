import type { LoanAssistantFields } from "./build-deal-analyze-request";
import type { DealAnalyzeCalculatorSlice } from "@/lib/engines/deal/policy/policy-snapshot";
import { resolvePurchaseTierRule } from "@/lib/engines/deal/policy/purchaseTierRule";

export type PurchaseSuggestionPolicy = Pick<
  DealAnalyzeCalculatorSlice,
  "purchaseTierRules"
>;

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

/** Indicative tier-specific advance, constrained by ARV when supplied. No rule means no suggestion. */
export function purchaseRequestedLoanSuggestedString(
  fields: LoanAssistantFields,
  calculator?: PurchaseSuggestionPolicy,
): string | null {
  const purchasePrice = parsePurchasePricePositive(fields.purchasePrice);
  if (purchasePrice === null) return null;
  const rule = resolvePurchaseTierRule(calculator, fields.experienceTier);
  if (!rule) return null;
  const rehab = parseNonNegativeMoney(fields.rehabBudget);
  const rehabPart =
    fields.borrowingRehabFunds === "yes" ? rule.rehabAdvancePct * rehab : 0;
  const acquisitionPart = rule.initialAdvancePct * purchasePrice;
  const arv = parsePurchasePricePositive(fields.arv);
  const amount = Math.min(
    acquisitionPart + rehabPart,
    arv === null ? Number.POSITIVE_INFINITY : rule.maxArvLtvPct * arv,
  );
  return String(Math.round((amount + Number.EPSILON) * 100) / 100);
}

export function purchaseRequestedLoanSuggestionDescription(
  fields: LoanAssistantFields,
  calculator?: PurchaseSuggestionPolicy,
): string {
  const rule = resolvePurchaseTierRule(calculator, fields.experienceTier);
  if (!rule) {
    return "No automatic suggestion is available without a configured experience tier. Enter a requested amount or leave blank for analysis; no current-policy amount is assumed.";
  }
  const rehab = fields.borrowingRehabFunds === "yes"
    ? ` plus ${rule.rehabAdvancePct * 100}% of rehab budget`
    : " (rehab funding excluded)";
  return `Suggested as ${rule.initialAdvancePct * 100}% of purchase price${rehab}, capped at ${rule.maxArvLtvPct * 100}% of ARV when entered — edit anytime. Final analysis rechecks the current policy.`;
}
