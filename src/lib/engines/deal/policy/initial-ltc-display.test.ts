import { describe, expect, it } from "vitest";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import { computeInitialLtcPercent } from "./initial-ltc-display";

describe("computeInitialLtcPercent", () => {
  it("returns acquisition / (purchase + rehab) for purchase", () => {
    const req = {
      deal: {
        purpose: "purchase" as const,
        purchasePrice: 100_000,
        rehabBudget: 50_000,
        productType: "bridge_purchase",
      },
    } as DealAnalyzeRequestV1;
    const loan = {
      acquisitionLoanAmount: 90_000,
    } as DealAnalyzeLoanOutV1;
    // 90000 / 150000 = 60%
    expect(computeInitialLtcPercent(req, loan)).toBe(60);
  });

  it("returns acquisition / (payoff + rehab) for refinance", () => {
    const req = {
      deal: {
        purpose: "refinance" as const,
        payoffAmount: 200_000,
        rehabBudget: 50_000,
        productType: "bridge_refinance",
      },
    } as DealAnalyzeRequestV1;
    const loan = {
      acquisitionLoanAmount: 125_000,
    } as DealAnalyzeLoanOutV1;
    // 125000 / 250000 = 50%
    expect(computeInitialLtcPercent(req, loan)).toBe(50);
  });
});
