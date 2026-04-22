import { describe, expect, it } from "vitest";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import { DEAL_ANALYZE_SCHEMA_VERSION } from "../schemas/deal-analyze-constants";
import { recommendedLoanAmount } from "./recommendedAmount";

function baseReq(
  overrides: Partial<DealAnalyzeRequestV1["deal"]>,
): DealAnalyzeRequestV1 {
  return {
    schemaVersion: DEAL_ANALYZE_SCHEMA_VERSION,
    deal: {
      purpose: "purchase",
      productType: "bridge_purchase",
      purchasePrice: 100_000,
      rehabBudget: 0,
      termMonths: null,
      ...overrides,
    },
    property: { arv: 200_000 },
  };
}

/**
 * Contract: `loan.amount` semantics (same as `recommendedLoanAmount` implementation).
 * If `requestedLoanAmount` exists → min(ask, policyMax); else → policyMax.
 */
describe("recommendedLoanAmount → loan.amount semantics", () => {
  it("when requestedLoanAmount exists, returns min(requestedLoanAmount, policyMax)", () => {
    const req = baseReq({ requestedLoanAmount: 50_000 });
    expect(recommendedLoanAmount(req, 60_000)).toBe(50_000);
    expect(recommendedLoanAmount(req, 40_000)).toBe(40_000);
  });

  it("when requestedLoanAmount is absent, returns policyMax", () => {
    const req = baseReq({});
    expect(recommendedLoanAmount(req, 72_000)).toBe(72_000);
  });
});
