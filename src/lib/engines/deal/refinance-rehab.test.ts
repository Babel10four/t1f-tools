import { describe, expect, it } from "vitest";
import { runDealAnalyze } from "./analyze";
import { getFallbackPolicySnapshot } from "./policy/policy-snapshot";
import type { DealAnalyzeRequestV1 } from "./schemas/canonical-request";

const fleetwood: DealAnalyzeRequestV1 = {
  schemaVersion: "deal_analyze.v1",
  deal: {
    purpose: "refinance",
    productType: "bridge_refinance",
    payoffAmount: 978_500,
    requestedLoanAmount: 1_027_500,
    rehabBudget: 150_000,
    termMonths: 12,
  },
  property: { asIsValue: 1_350_000, arv: 1_800_000 },
  borrower: { fico: 780, experienceTier: "1" },
  assumptions: {
    borrowingRehabFunds: true,
    noteRatePercent: 10,
    originationPointsPercent: 0.5,
    originationFlatFee: 1_195,
  },
};

describe("refinance with financed rehab", () => {
  it("reserves the full rehab holdback and calculates cash from the unfunded payoff", async () => {
    const fallback = getFallbackPolicySnapshot();
    const result = await runDealAnalyze(fleetwood, {
      policySnapshot: {
        ...fallback,
        source: "published",
        calculator: { ...fallback.calculator, refinanceMaxLtvPct: 0.8 },
      },
    });
    expect(result.loan.amount).toBe(1_027_500);
    expect(result.loan.acquisitionLoanAmount).toBe(877_500);
    expect(result.loan.rehabLoanAmount).toBe(150_000);
    expect(result.cashToClose.items[0].amount).toBe(101_000);
    expect(result.cashToClose.items[1].amount).toBe(5_137.5);
    expect(result.cashToClose.estimatedTotal).toBe(122_745);
    expect(result.risks.some((risk) => risk.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(false);
  });

  it("keeps the existing total-loan policy cap and increases the payoff gap when capped", async () => {
    const result = await runDealAnalyze(fleetwood);
    expect(result.loan.requestedLoanAmount).toBe(1_027_500);
    expect(result.loan.amount).toBe(1_012_500);
    expect(result.loan.acquisitionLoanAmount).toBe(862_500);
    expect(result.loan.rehabLoanAmount).toBe(150_000);
    expect(result.cashToClose.items[0].amount).toBe(116_000);
    expect(result.cashToClose.items[1].amount).toBe(5_062.5);
    expect(result.cashToClose.estimatedTotal).toBe(137_445);
    expect(result.risks.some((risk) => risk.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(true);
  });

  it("uses the entire initial loan toward payoff when the borrower declines rehab funds", async () => {
    const result = await runDealAnalyze({
      ...fleetwood,
      deal: { ...fleetwood.deal, requestedLoanAmount: 877_500 },
      assumptions: { ...fleetwood.assumptions, borrowingRehabFunds: false },
    });
    expect(result.loan.acquisitionLoanAmount).toBe(877_500);
    expect(result.loan.rehabLoanAmount).toBe(0);
    expect(result.cashToClose.items[0].amount).toBe(101_000);
  });

  it("does not invent a payoff contribution when only a requested amount is provided", async () => {
    const result = await runDealAnalyze({
      ...fleetwood,
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        requestedLoanAmount: 1_027_500,
        rehabBudget: 150_000,
        termMonths: 12,
      },
    });
    expect(result.loan.amount).toBe(1_012_500);
    expect(result.cashToClose).toEqual({
      status: "insufficient_inputs",
      estimatedTotal: null,
      items: [],
    });
  });
});
