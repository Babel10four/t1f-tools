import type { DealAnalyzePricingStatus } from "../schemas/deal-engine-v1-enums";

/**
 * `pricing.status` / `cashToClose.status` for **supported** v1 paths after policy max is known.
 * Unsupported products use **`stub`** at the orchestrator (not routed here).
 *
 * @see docs/specs/TICKET-002.md — Pricing status semantics
 */
export function pricingStatusForSupportedDeal(input: {
  policyMaxDefined: boolean;
  borrowerFicoDefined: boolean;
}): DealAnalyzePricingStatus {
  if (!input.policyMaxDefined) {
    return "insufficient_inputs";
  }
  if (input.borrowerFicoDefined) {
    return "complete";
  }
  return "indicative";
}
