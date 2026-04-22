import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";

/**
 * Policy-backed value for **`loan.amount`** (nested contract extension on `loan`).
 *
 * **Frozen semantics (do not paraphrase in implementation — keep in sync with tests):**
 * - If `deal.requestedLoanAmount` is defined → **`min(requestedLoanAmount, policyMax)`**
 * - Else → **`policyMax`**
 *
 * When `policyMax` is undefined (e.g. refinance indeterminate basis), the caller must
 * omit **`loan.amount`** — do not invent a number.
 */
export function recommendedLoanAmount(
  req: DealAnalyzeRequestV1,
  policyMax: number,
): number {
  const ask = req.deal.requestedLoanAmount;
  if (ask !== undefined && typeof ask === "number") {
    return Math.round(Math.min(ask, policyMax) * 100) / 100;
  }
  return Math.round(policyMax * 100) / 100;
}
