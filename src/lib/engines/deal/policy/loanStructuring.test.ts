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
  it("preserves the full rehab budget for purchases without a tier-specific rule", () => {
    const r = splitAcquisitionRehabLoan({
      totalLoan: 142_500,
      purpose: "purchase",
      purchasePrice: 75_000,
      rehabBudget: 75_000,
      borrowingRehabFunds: true,
      useTier12PurchaseWaterfall: false,
    });
    expect(r).toEqual({ acquisitionLoanAmount: 67_500, rehabLoanAmount: 75_000 });
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
    expect(r).toEqual({ acquisitionLoanAmount: 67_500, rehabLoanAmount: 75_000 });
  });

  it("assigns all to acquisition when not borrowing rehab", () => {
    const r = splitAcquisitionRehabLoan({
      totalLoan: 100_000,
      purpose: "purchase",
      purchasePrice: 75_000,
      rehabBudget: 75_000,
      borrowingRehabFunds: false,
    });
    expect(r).toEqual({ acquisitionLoanAmount: 100_000, rehabLoanAmount: 0 });
  });

  it("reserves the full refinance rehab holdback and applies the remainder toward payoff", () => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 1_027_500,
      purpose: "refinance",
      payoffAmount: 978_500,
      rehabBudget: 150_000,
      borrowingRehabFunds: true,
    })).toEqual({ acquisitionLoanAmount: 877_500, rehabLoanAmount: 150_000 });
  });

  it("keeps a refinance without financed rehab entirely in initial funds", () => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 877_500,
      purpose: "refinance",
      payoffAmount: 978_500,
      rehabBudget: 150_000,
      borrowingRehabFunds: false,
    })).toEqual({ acquisitionLoanAmount: 877_500, rehabLoanAmount: 0 });
  });

  it("withholds an infeasible refinance rather than partially funding rehab", () => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 100_000,
      purpose: "refinance",
      rehabBudget: 150_000,
      borrowingRehabFunds: true,
    })).toBeUndefined();
  });

  it.each(["purchase", "refinance"] as const)("withholds %s when one cent short of full rehab", (purpose) => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 59_999.99, purpose, rehabBudget: 60_000, borrowingRehabFunds: true,
    })).toBeUndefined();
  });

  it.each(["purchase", "refinance"] as const)("allows exactly full rehab with zero initial %s proceeds", (purpose) => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 60_000, purpose, rehabBudget: 60_000, borrowingRehabFunds: true,
    })).toEqual({ acquisitionLoanAmount: 0, rehabLoanAmount: 60_000 });
  });

  it.each([true, undefined])("rounds money consistently with rehab selection %s", (borrowingRehabFunds) => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 95_000.04, purpose: "purchase", rehabBudget: 10_000.01, borrowingRehabFunds,
    })).toEqual({ acquisitionLoanAmount: 85_000.03, rehabLoanAmount: 10_000.01 });
  });

  it("does not use a stale partial-rehab policy rule", () => {
    expect(splitAcquisitionRehabLoan({
      totalLoan: 165_000, purpose: "purchase", rehabBudget: 60_000, borrowingRehabFunds: true,
      purchaseAdvanceRule: { initialAdvancePct: 0.75, rehabAdvancePct: 0.75, maxArvLtvPct: 0.7 },
    })).toBeUndefined();
  });
});
