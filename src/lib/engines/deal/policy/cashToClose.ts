/**
 * Cash-to-close construction for supported v1 paths.
 * @see docs/business-rules/deal-engine-v1-assumptions.md — labels, order, rounding, totals
 */
export {
  buildCashToCloseLinesPurchase,
  buildCashToCloseLinesRefinance,
  cashToCloseLinesForPurpose,
} from "./cashToCloseLines";
