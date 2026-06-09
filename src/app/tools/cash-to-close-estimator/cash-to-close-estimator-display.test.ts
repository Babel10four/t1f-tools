import { describe, expect, it } from "vitest";
import type {
  DealAnalyzeLoanOutV1,
  DealAnalyzePricingOutV1,
} from "@/lib/engines/deal/schemas/canonical-response";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildCashToCloseLoanCostSummary,
  buildCashToCloseClientSummaryText,
  estimateInterestOnlyMonthlyPayment,
  transformCashToCloseDisplayLines,
} from "./cash-to-close-estimator-display";

describe("transformCashToCloseDisplayLines", () => {
  it("renames borrower equity to Down payment and excludes title/insurance row", () => {
    const items = [
      { label: "Borrower equity", amount: 10_000 },
      { label: "Estimated points", amount: 500 },
      { label: "Estimated lender fees", amount: 1_000 },
      { label: "Estimated closing costs", amount: 1_500 },
      { label: "Holdback / reserve (if applicable)", amount: 0 },
      { label: "Total estimated cash to close", amount: 13_000 },
    ];
    const out = transformCashToCloseDisplayLines(items, {
      purpose: "purchase",
      purchasePrice: 100_000,
    });
    expect(out[0]).toMatchObject({
      label: "Down payment",
      amount: 10_000,
    });
    expect(out[1]).toMatchObject({
      label: "Loan fees (points + lender fees)",
      amount: 1_500,
    });
    expect(out[1]?.footnote).toMatch(
      /not included in the cash-to-close estimate/i,
    );
    expect(out[out.length - 1]?.label).toBe("Total estimated cash to close");
    expect(
      out.some((row) => row.label.includes("title / insurance")),
    ).toBe(false);
  });

  it("merges fee lines on refinance without renaming payoff", () => {
    const items = [
      { label: "Payoff / unwind amount", amount: 200_000 },
      { label: "Estimated points", amount: 1_000 },
      { label: "Estimated lender fees", amount: 2_000 },
      { label: "Estimated closing costs", amount: 3_000 },
      { label: "Reserves / escrows (if applicable)", amount: 0 },
      { label: "Total estimated cash to close", amount: 206_000 },
    ];
    const out = transformCashToCloseDisplayLines(items, { purpose: "refinance" });
    expect(out[0]?.label).toBe("Payoff / unwind amount");
    expect(out[1]).toMatchObject({
      label: "Loan fees (points + lender fees)",
      amount: 3_000,
    });
    expect(
      out.some((row) => row.label.includes("title / insurance")),
    ).toBe(false);
  });
});

describe("buildCashToCloseLoanCostSummary", () => {
  it("computes loan costs excluding title/insurance with per-diem interest formula", () => {
    const response = {
      loan: { amount: 90_000, acquisitionLoanAmount: 80_000 },
      pricing: { noteRatePercent: 9 },
      cashToClose: {
        items: [
          { label: "Borrower equity", amount: 20_000 },
          { label: "Estimated points", amount: 900 },
          { label: "Estimated lender fees", amount: 450 },
          { label: "Estimated closing costs", amount: 1_200 },
        ],
      },
    } as unknown as DealAnalyzeResponseV1;
    const summary = buildCashToCloseLoanCostSummary({
      flow: "purchase",
      response,
      asOfDate: new Date(2026, 4, 8), // May 8, 2026 -> 24 days inclusive through month-end
    });
    expect(summary.basisLabel).toBe("Down payment");
    expect(summary.basisAmount).toBe(20_000);
    expect(summary.loanFees).toBe(1_350);
    expect(summary.titleInsuranceEstimate).toBe(1_200);
    expect(summary.perDiem).toBe(20);
    expect(summary.remainingDaysInMonth).toBe(24);
    expect(summary.firstFullMonthInterest).toBe(600);
    expect(summary.interestCosts).toBe(1080);
    expect(summary.estimatedLoanCostsExcludingTitleInsurance).toBe(22_430);
  });
});

describe("estimateInterestOnlyMonthlyPayment", () => {
  it("returns interest-only payment when inputs are present", () => {
    const loan: Pick<DealAnalyzeLoanOutV1, "amount" | "termMonths"> = {
      amount: 120_000,
      termMonths: 12,
    };
    const pricing: Pick<DealAnalyzePricingOutV1, "noteRatePercent"> = {
      noteRatePercent: 12,
    };
    const r = estimateInterestOnlyMonthlyPayment(
      loan as DealAnalyzeLoanOutV1,
      pricing as DealAnalyzePricingOutV1,
    );
    expect(r).toBe(1200);
  });

  it("returns null when note rate missing", () => {
    const r = estimateInterestOnlyMonthlyPayment(
      { amount: 100_000, termMonths: 12 } as DealAnalyzeLoanOutV1,
      { noteRatePercent: null } as DealAnalyzePricingOutV1,
    );
    expect(r).toBeNull();
  });
});

describe("buildCashToCloseClientSummaryText", () => {
  it("includes note rate and interest-only line for paste/email", () => {
    const request = {
      deal: { purchasePrice: 100_000 },
    } as DealAnalyzeRequestV1;
    const response = {
      pricing: {
        status: "complete",
        noteRatePercent: 10.25,
        marginBps: null,
        discountPoints: null,
        lockDays: null,
      },
      loan: {
        amount: 80_000,
        termMonths: 12,
      },
      cashToClose: {
        status: "complete",
        estimatedTotal: 25_000,
        items: [
          { label: "Borrower equity", amount: 20_000 },
          { label: "Estimated points", amount: 500 },
          { label: "Estimated lender fees", amount: 1_000 },
          { label: "Estimated closing costs", amount: 1_500 },
          { label: "Holdback / reserve (if applicable)", amount: 0 },
          { label: "Total estimated cash to close", amount: 23_000 },
        ],
      },
    } as DealAnalyzeResponseV1;
    const text = buildCashToCloseClientSummaryText({
      flow: "purchase",
      response,
      request,
    });
    expect(text).toContain("Note rate: 10.25%");
    expect(text).toContain("interest-only");
    expect(text).toContain("Down payment:");
    expect(text).toContain("Loan fees (points + lender fees)");
    expect(text).toMatch(/Title\/insurance: not included/i);
    expect(text).toMatch(/Assumed closing date for interest/i);
  });

  it("names a user-selected closing date and excludes the 'today' fallback wording", () => {
    const request = {
      deal: { purchasePrice: 100_000 },
    } as DealAnalyzeRequestV1;
    const response = {
      pricing: { status: "complete", noteRatePercent: 10, marginBps: null },
      loan: { amount: 80_000, termMonths: 12 },
      cashToClose: {
        status: "complete",
        estimatedTotal: 25_000,
        items: [
          { label: "Borrower equity", amount: 20_000 },
          { label: "Estimated points", amount: 500 },
          { label: "Total estimated cash to close", amount: 20_500 },
        ],
      },
    } as DealAnalyzeResponseV1;
    const text = buildCashToCloseClientSummaryText({
      flow: "purchase",
      response,
      request,
      asOfDate: new Date(2026, 5, 15), // Jun 15, 2026
    });
    expect(text).toContain("Assumed closing date for interest: Jun 15, 2026.");
    expect(text).not.toContain("when this summary is generated");
  });
});
