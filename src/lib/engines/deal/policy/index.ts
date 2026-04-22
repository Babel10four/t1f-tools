/** Public policy surface for Deal Engine v1 — no UI / HTTP imports. */
export {
  POLICY_DEFAULT_TERM_MONTHS,
  POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  POLICY_REFINANCE_MAX_LTV_PCT,
} from "./constants";
export { cashToCloseLinesForPurpose } from "./cashToClose";
export { purchasePolicyMax } from "./purchaseMax";
export { recommendedLoanAmount } from "./recommendedAmount";
export { refinancePolicyMax } from "./refinanceMax";
export type { RefinancePolicyMaxResult } from "./refinanceMax";
export { pricingStatusForSupportedDeal } from "./pricingStatus";
export { buildDealAnalyzeRisks } from "./risks";
export { isSupportedV1Product, supportedProduct } from "./support";
