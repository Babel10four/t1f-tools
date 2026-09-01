import { describe, expect, it } from "vitest";
import {
  calculateLoanCalculator,
  validateLoanCalculatorInput,
} from "./calculate";
import type { LoanCalculatorInput } from "./types";

function workbookExample(
  overrides: Partial<LoanCalculatorInput> = {},
): LoanCalculatorInput {
  return {
    state: "FL",
    borrowerTier: 1,
    flipsCompletedWithT1f: 3,
    fico: 736,
    purpose: "purchase_with_rehab",
    propertyType: "sfr",
    totalBorrowerExposure: 0,
    city: "Tampa, FL",
    monthsOfSupply: 4.3,
    purchasePrice: 250_000,
    assignmentFees: 0,
    sellerConcessions: 0,
    documentedImprovements: 0,
    rehabBudget: 50_000,
    rehabHoldback: 50_000,
    arv: 1_000_000,
    asIsValue: 0,
    requestedPoints: 0.01,
    ...overrides,
  };
}

describe("T1F Loan Calculator workbook parity", () => {
  it("matches the visible workbook example", () => {
    const input = workbookExample();
    expect(validateLoanCalculatorInput(input)).toEqual([]);

    const result = calculateLoanCalculator(input);
    expect(result.costBasis).toBe(250_000);
    expect(result.maxLtc).toBe(0.9);
    expect(result.maxInitialLoanByLtc).toBe(225_000);
    expect(result.maxArvLtv).toBe(0.75);
    expect(result.maxTotalLoanByArv).toBe(750_000);
    expect(result.calculatedTotalLoan).toBe(275_000);
    expect(result.initialLoanAmount).toBe(225_000);
    expect(result.rehabHoldbackLoanAmount).toBe(50_000);
    expect(result.fundedTotalLoanAmount).toBe(275_000);
    expect(result.downPaymentRequired).toBe(25_000);
    expect(result.actualInitialLtc).toBe(0.9);
    expect(result.actualArvLtv).toBe(0.275);
    expect(result.borrowerRatePercent).toBe(9.25);
    expect(result.budgetPointsPercent).toBe(0.4);
    expect(result.adjustedPointsPercent).toBe(0.75);
    expect(result.revisedRatePercent).toBe(8.75);
    expect(result.maxInitialConstructionDraw).toBe(15_000);
    expect(result.initialPlusFirstAdvanceLtc).toBe(0.96);
    expect(result.constructionAdvance.eligible).toBe(true);
    expect(result.virtualInspection.eligible).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("uses the workbook refinance AIV and pricing path", () => {
    const input = workbookExample({
      purpose: "refinance_rate_term",
      purchasePrice: 0,
      rehabBudget: 0,
      rehabHoldback: 0,
      arv: 0,
      asIsValue: 500_000,
      requestedPoints: undefined,
    });

    expect(validateLoanCalculatorInput(input)).toEqual([]);
    const result = calculateLoanCalculator(input);
    expect(result.maxAsIsLtv).toBe(0.7);
    expect(result.maxLoanByAsIsValue).toBe(350_000);
    expect(result.calculatedTotalLoan).toBe(350_000);
    expect(result.initialLoanAmount).toBe(350_000);
    expect(result.actualAsIsLtv).toBe(0.7);
    expect(result.borrowerRatePercent).toBe(10.125);
  });

  it("returns a pricing exception for the unavailable tier-four rate grid", () => {
    const result = calculateLoanCalculator(
      workbookExample({ borrowerTier: 4, requestedPoints: undefined }),
    );
    expect(result.borrowerRatePercent).toBeNull();
    expect(result.warnings).toContain(
      "Pricing exception required for this tier, leverage, or FICO combination.",
    );
  });

  it("applies CA, WA, and other-state special-program caps", () => {
    const ca = calculateLoanCalculator(workbookExample({ state: "CA" }));
    const wa = calculateLoanCalculator(workbookExample({ state: "WA" }));
    const fl = calculateLoanCalculator(workbookExample({ state: "FL" }));
    const cap = (result: ReturnType<typeof calculateLoanCalculator>) =>
      result.constructionAdvance.checks.find(
        (check) => check.key === "maximum_initial_loan",
      )?.requirement;
    expect(cap(ca)).toBe("$1,500,000 or less");
    expect(cap(wa)).toBe("$1,250,000 or less");
    expect(cap(fl)).toBe("$750,000 or less");
  });

  it("normalizes Purchase — No Rehab to zero rehab and holdback", () => {
    expect(
      validateLoanCalculatorInput(
        workbookExample({
          purpose: "purchase_no_rehab",
          rehabBudget: 25_000,
          rehabHoldback: 0,
        }),
      ),
    ).toContainEqual({
      field: "rehabBudget",
      message: "Only Purchase — With Rehab can include a rehab budget or holdback.",
    });
  });

  it("keeps the 4.5-month supply boundary eligible", () => {
    const atBoundary = calculateLoanCalculator(
      workbookExample({ monthsOfSupply: 4.5 }),
    );
    const overBoundary = calculateLoanCalculator(
      workbookExample({ monthsOfSupply: 4.6 }),
    );
    expect(atBoundary.constructionAdvance.eligible).toBe(true);
    expect(overBoundary.constructionAdvance.eligible).toBe(false);
  });
});
