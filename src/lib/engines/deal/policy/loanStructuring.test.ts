import { describe, expect, it } from "vitest";
import {
  parseDealStructuringAssumptions,
  splitAcquisitionRehabLoan,
} from "./loanStructuring";

describe("parseDealStructuringAssumptions", () => {
  it("reads known keys", () => {
    expect(
      parseDealStructuringAssumptions({
        borrowingRehabFunds: false,
        originationPointsPercent: 0.65,
        originationFlatFee: 1195,
      }),
    ).toEqual({
      borrowingRehabFunds: false,
      originationPointsPercent: 0.65,
      originationFlatFee: 1195,
    });
  });
});

describe("splitAcquisitionRehabLoan", () => {
  it("splits purchase loan by cost mix when borrowing rehab (non–tier-12 proportional)", () => {
    const r = splitAcquisitionRehabLoan({
      totalLoan: 142_500,
      purpose: "purchase",
      purchasePrice: 75_000,
      rehabBudget: 75_000,
      borrowingRehabFunds: true,
      useTier12PurchaseWaterfall: false,
    });
    expect(r.acquisitionLoanAmount).toBe(71250);
    expect(r.rehabLoanAmount).toBe(71250);
  });

  it("tier 1/2 waterfall: 90% purchase and 100% rehab when totals allow", () => {
    const r = splitAcquisitionRehabLoan({
      totalLoan: 142_500,
      purpose: "purchase",
      purchasePrice: 75_000,
      rehabBudget: 75_000,
      borrowingRehabFunds: true,
      useTier12PurchaseWaterfall: true,
    });
    expect(r.acquisitionLoanAmount).toBe(67_500);
    expect(r.rehabLoanAmount).toBe(75_000);
  });

  it("assigns all to acquisition when not borrowing rehab", () => {
    const r = splitAcquisitionRehabLoan({
      totalLoan: 100_000,
      purpose: "purchase",
      purchasePrice: 75_000,
      rehabBudget: 75_000,
      borrowingRehabFunds: false,
    });
    expect(r.acquisitionLoanAmount).toBe(100_000);
    expect(r.rehabLoanAmount).toBe(0);
  });
});
