import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";

/**
 * Same denominator as total LTC in {@link applyLoanStructuring} (purchase price + rehab,
 * or payoff + rehab for refinance). Numerator is acquisition slice only — user-facing
 * "Initial LTC."
 */
function projectCostBasisForInitialLtc(req: DealAnalyzeRequestV1): number | undefined {
  const { deal } = req;
  const rehab = deal.rehabBudget ?? 0;
  if (deal.purpose === "purchase" && deal.purchasePrice !== undefined) {
    const basis = deal.purchasePrice + rehab;
    return basis > 0 ? basis : undefined;
  }
  if (deal.purpose === "refinance") {
    const payoff = deal.payoffAmount ?? 0;
    const basis = payoff + rehab;
    return basis > 0 ? basis : undefined;
  }
  return undefined;
}

export function computeInitialLtcPercent(
  req: DealAnalyzeRequestV1,
  loan: DealAnalyzeLoanOutV1,
): number | undefined {
  const acq = loan.acquisitionLoanAmount;
  if (acq === undefined || !(acq > 0)) {
    return undefined;
  }
  const basis = projectCostBasisForInitialLtc(req);
  if (basis === undefined || !(basis > 0)) {
    return undefined;
  }
  return Math.round((acq / basis) * 10000) / 100;
}
