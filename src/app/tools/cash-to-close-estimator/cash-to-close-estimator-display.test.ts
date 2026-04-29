import { describe, expect, it } from "vitest";
import type {
  DealAnalyzeLoanOutV1,
  DealAnalyzePricingOutV1,
} from "@/lib/engines/deal/schemas/canonical-response";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildCashToCloseClientSummaryText,
  estimateMonthlyPayments,
  transformCashToCloseDisplayLines,
} from "./cash-to-close-estimator-display";

describe("transformCashToCloseDisplayLines", () => {
  it("renames borrower equity to Down payment with percent of purchase", () => {
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
      sublabel: "10% of purchase price",
    });
    expect(out[1]).toMatchObject({
      label: "Total points & fees",
      amount: 3_000,
    });
    expect(out[1]?.footnote).toContain("Third-party closing fees are estimated");
    expect(out[out.length - 1]?.label).toBe("Total estimated cash to close");
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
    expect(out[1]).toMatchObject({ label: "Total points & fees", amount: 6_000 });
  });
});

describe("estimateMonthlyPayments", () => {
  it("returns interest-only and amortizing when inputs are present", () => {
    const loan: Pick<DealAnalyzeLoanOutV1, "amount" | "termMonths"> = {
      amount: 120_000,
      termMonths: 12,
    };
    const pricing: Pick<DealAnalyzePricingOutV1, "noteRatePercent"> = {
      noteRatePercent: 12,
    };
    const r = estimateMonthlyPayments(
      loan as DealAnalyzeLoanOutV1,
      pricing as DealAnalyzePricingOutV1,
    );
    expect(r.interestOnlyPerMonth).toBe(1200);
    expect(r.amortizingPerMonth).toBeGreaterThan(0);
    expect(r.amortizingPerMonth).toBeGreaterThan(r.interestOnlyPerMonth!);
    expect(r.amortizingPerMonth).toBeCloseTo(10_661.85, 1);
  });

  it("returns nulls when note rate missing", () => {
    const r = estimateMonthlyPayments(
      { amount: 100_000, termMonths: 12 } as DealAnalyzeLoanOutV1,
      { noteRatePercent: null } as DealAnalyzePricingOutV1,
    );
    expect(r.interestOnlyPerMonth).toBeNull();
    expect(r.amortizingPerMonth).toBeNull();
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
    expect(text).toContain("Total points & fees");
    expect(text).toContain("Third-party closing fees are estimated");
  });
});
