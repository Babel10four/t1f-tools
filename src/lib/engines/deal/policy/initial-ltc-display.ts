import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import { normalizePurchaseTier } from "./purchaseTierRule";

export function initialLtcDescription(req: DealAnalyzeRequestV1 | undefined): string {
  if (req?.deal.purpose === "purchase" && normalizePurchaseTier(req.borrower?.experienceTier) === "3") {
    return "Initial acquisition loan as % of purchase price; future rehab is a separate holdback.";
  }
  return "Acquisition loan as % of project cost basis (purchase + rehab, or payoff + rehab).";
}

/**
 * Tier 3 purchase initial LTC uses purchase price (future SOW is a separate holdback).
 * Existing other-tier/refinance presentation retains project-cost denominator.
 * Total LTC remains a separate metric in applyLoanStructuring.
 */
function projectCostBasisForInitialLtc(req: DealAnalyzeRequestV1): number | undefined {
  const { deal } = req;
  const rehab = deal.rehabBudget ?? 0;
  if (deal.purpose === "purchase" && deal.purchasePrice !== undefined) {
    // Published Tier 3 initial LTC excludes the separately held future SOW budget.
    const basis = normalizePurchaseTier(req.borrower?.experienceTier) === "3"
      ? deal.purchasePrice : deal.purchasePrice + rehab;
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
