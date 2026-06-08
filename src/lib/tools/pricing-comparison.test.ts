import { describe, expect, it } from "vitest";
import {
  computePricingComparison,
  type PricingComparisonInputs,
} from "./pricing-comparison";

/** Inputs from the source Google Sheet screenshot. */
const SHEET_INPUTS: PricingComparisonInputs = {
  purchasePrice: 0,
  initialLoanAmount: 250_000,
  holdbackAmount: 50_000,
  avgHoldbackDisbursedFraction: 0.5,
  loanDurationMonths: 8,
  t1f: {
    structure: "non_dutch",
    leveragePercentOfPurchase: null,
    ratePercent: 8.5,
    originationPointsPercent: 0.5,
    adminFees: 1_195,
  },
  competitor: {
    structure: "dutch",
    leveragePercentOfPurchase: null,
    ratePercent: 8.5,
    originationPointsPercent: 0.5,
    adminFees: 1_195,
  },
};

describe("computePricingComparison", () => {
  it("reproduces the source sheet to the dollar", () => {
    const r = computePricingComparison(SHEET_INPUTS);

    expect(r.t1f.totalLoanAmount).toBe(300_000);
    expect(r.competitor.totalLoanAmount).toBe(300_000);

    // T1F (non-dutch / draw): base 275,000.
    expect(r.t1f.interestBase).toBe(275_000);
    expect(Math.round(r.t1f.interest)).toBe(15_583);
    expect(Math.round(r.t1f.originationPointsDollars)).toBe(1_500);
    expect(Math.round(r.t1f.totalInterestPointsFees)).toBe(18_278);
    expect(Math.round(r.t1f.revenue)).toBe(2_695);
    expect(Math.round(r.t1f.adjustedTotalInterestPointsFees)).toBe(18_278);

    // Competitor (dutch / term): base 325,000.
    expect(r.competitor.interestBase).toBe(325_000);
    expect(Math.round(r.competitor.interest)).toBe(18_417);
    expect(Math.round(r.competitor.totalInterestPointsFees)).toBe(21_112);

    // Comparison: computed on raw values, rounded for display.
    expect(Math.round(r.pricingGap)).toBe(2_833);
    expect(Math.round(r.upfrontSavings)).toBe(0);
  });

  it("swapping structures swaps the interest bases", () => {
    const r = computePricingComparison({
      ...SHEET_INPUTS,
      t1f: { ...SHEET_INPUTS.t1f, structure: "dutch" },
      competitor: { ...SHEET_INPUTS.competitor, structure: "non_dutch" },
    });
    expect(r.t1f.interestBase).toBe(325_000);
    expect(r.competitor.interestBase).toBe(275_000);
    // T1F now costs more than the competitor, so the gap is negative.
    expect(Math.round(r.pricingGap)).toBe(-2_833);
  });

  it("non-dutch and dutch differ by interest on the full holdback", () => {
    const r = computePricingComparison(SHEET_INPUTS);
    const holdbackInterest =
      50_000 * (8.5 / 100 / 12) * 8; // 2,833.33
    expect(r.competitor.interest - r.t1f.interest).toBeCloseTo(
      holdbackInterest,
      6,
    );
  });

  it("upfront savings reflect only points + fees differences", () => {
    const r = computePricingComparison({
      ...SHEET_INPUTS,
      competitor: {
        ...SHEET_INPUTS.competitor,
        originationPointsPercent: 2,
        adminFees: 2_000,
      },
    });
    // Competitor upfront: 2% of 300k (6,000) + 2,000 = 8,000; T1F: 1,500 + 1,195 = 2,695.
    expect(Math.round(r.upfrontSavings)).toBe(8_000 - 2_695);
  });

  it("derives each side's loan from leverage on the purchase price", () => {
    // Same deal (300k purchase, 50k rehab) but T1F lends 90% of purchase, competitor 100%.
    const r = computePricingComparison({
      purchasePrice: 300_000,
      initialLoanAmount: 0,
      holdbackAmount: 50_000,
      avgHoldbackDisbursedFraction: 0.5,
      loanDurationMonths: 8,
      t1f: {
        structure: "non_dutch",
        leveragePercentOfPurchase: 90,
        ratePercent: 8.5,
        originationPointsPercent: 0.5,
        adminFees: 1_195,
      },
      competitor: {
        structure: "dutch",
        leveragePercentOfPurchase: 100,
        ratePercent: 8.5,
        originationPointsPercent: 0.5,
        adminFees: 1_195,
      },
    });

    // T1F: acquisition 270k, total 320k, down payment 30k.
    expect(r.t1f.acquisitionLoanAmount).toBe(270_000);
    expect(r.t1f.totalLoanAmount).toBe(320_000);
    expect(r.t1f.borrowerDownPayment).toBe(30_000);
    expect(r.t1f.interestBase).toBe(295_000); // 270k + 25k avg holdback
    expect(Math.round(r.t1f.interest)).toBe(16_717);
    expect(Math.round(r.t1f.totalInterestPointsFees)).toBe(19_512);

    // Competitor: acquisition 300k, total 350k, no down payment (100% leverage).
    expect(r.competitor.acquisitionLoanAmount).toBe(300_000);
    expect(r.competitor.totalLoanAmount).toBe(350_000);
    expect(r.competitor.borrowerDownPayment).toBe(0);
    expect(r.competitor.interestBase).toBe(375_000); // 350k + 25k avg holdback
    expect(Math.round(r.competitor.interest)).toBe(21_250);
    expect(Math.round(r.competitor.totalInterestPointsFees)).toBe(24_195);

    expect(Math.round(r.pricingGap)).toBe(4_683);
    expect(Math.round(r.upfrontSavings)).toBe(150);
  });

  it("ignores leverage when no purchase price is provided", () => {
    const r = computePricingComparison({
      ...SHEET_INPUTS,
      t1f: { ...SHEET_INPUTS.t1f, leveragePercentOfPurchase: 90 },
    });
    // Falls back to the shared initial loan amount (250k acquisition).
    expect(r.t1f.acquisitionLoanAmount).toBe(250_000);
    expect(r.t1f.borrowerDownPayment).toBeNull();
  });
});
