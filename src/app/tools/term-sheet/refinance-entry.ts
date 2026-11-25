import type { LoanAssistantFields } from "../loan-structuring-assistant/build-deal-analyze-request";

const dollarFields = [
  "payoffAmount", "requestedLoanAmount", "rehabBudget", "asIsValue", "arv", "originationFlatFee",
] as const;

/** Accept pasted US currency without silently accepting mistyped separators like 15,00. */
export function normalizeDollars(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?$/.test(trimmed)) return raw;
  return trimmed.replace(/^\$\s*/, "").replaceAll(",", "");
}

export function normalizedRefinanceFields(fields: LoanAssistantFields): LoanAssistantFields {
  const normalized = { ...fields };
  for (const key of dollarFields) normalized[key] = normalizeDollars(fields[key]);
  return normalized;
}

export function numberOrNull(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

const numericRules = {
  payoffAmount: { label: "Existing loan payoff", positive: true },
  requestedLoanAmount: { label: "Requested loan amount", positive: true },
  rehabBudget: { label: "Rehab budget" },
  asIsValue: { label: "As-is value", positive: true },
  arv: { label: "After-repair value", positive: true },
  fico: { label: "FICO", positive: true, max: 850 },
  termMonths: { label: "Term" },
  noteRatePercent: { label: "Note rate", max: 100 },
  originationPointsPercent: { label: "Lender points" },
  originationFlatFee: { label: "Flat lender fee" },
} satisfies Record<string, { label: string; positive?: boolean; max?: number }>;

export type RefinanceNumberField = keyof typeof numericRules;

export function fieldError(key: RefinanceNumberField, raw: string): string | undefined {
  if (!raw.trim()) return;
  const rule = numericRules[key];
  const value = numberOrNull(raw);
  if (value === null || ("positive" in rule && value === 0)) {
    return rule.label + ("positive" in rule ? " must be a positive number." : " must be a non-negative number.");
  }
  if ("max" in rule && value > rule.max) return rule.label + " must be " + rule.max + " or less.";
}

export function validateRefinanceFields(fields: LoanAssistantFields): string | null {
  const actual = normalizedRefinanceFields(fields);
  for (const key of Object.keys(numericRules) as RefinanceNumberField[]) {
    const message = fieldError(key, actual[key]);
    if (message) return message;
  }
  return null;
}

// Avoid a binary rounding artifact when two monetary amounts in cents are combined.
export function sumMoney(left: number, right: number): number {
  const cents = Math.round(left * 100) + Math.round(right * 100);
  if (Number.isSafeInteger(cents) && Math.round(left * 100) / 100 === left && Math.round(right * 100) / 100 === right) {
    return cents / 100;
  }
  return left + right;
}
