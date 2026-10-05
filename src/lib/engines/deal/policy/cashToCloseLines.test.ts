import { describe, expect, it } from "vitest";
import {
  buildCashToCloseLinesPurchase,
  buildCashToCloseLinesRefinance,
} from "./cashToCloseLines";

const PURCHASE_LABELS = [
  "Borrower equity",
  "Estimated points",
  "Estimated lender fees",
  "Estimated closing costs",
  "Holdback / reserve (if applicable)",
  "Total estimated cash to close",
] as const;

const REFINANCE_LABELS = [
  "Payoff / unwind amount",
  "Estimated points",
  "Estimated lender fees",
  "Estimated closing costs",
  "Reserves / escrows (if applicable)",
  "Total estimated cash to close",
] as const;

describe("cashToCloseLines (TICKET-002 / business-rules)", () => {
  it("purchase: borrower equity is purchase price minus initial/acquisition loan", () => {
    const { items } = buildCashToCloseLinesPurchase({
      purchasePrice: 100_000,
      loanAmount: 90_000,
    });
    expect(items[0]).toMatchObject({
      label: "Borrower equity",
      amount: 10_000,
    });
  });

  it("purchase: exact labels, order, and line 6 equals sum of lines 1–5", () => {
    const { items, estimatedTotal } = buildCashToCloseLinesPurchase({
      purchasePrice: 350_000,
      loanAmount: 262_500,
    });
    expect(items.map((i) => i.label)).toEqual([...PURCHASE_LABELS]);
    const sumFirstFive = items
      .slice(0, 5)
      .reduce((s, row) => s + row.amount, 0);
    expect(items[5].label).toBe("Total estimated cash to close");
    expect(items[5].amount).toBeCloseTo(sumFirstFive, 10);
    expect(estimatedTotal).toBe(items[5].amount);
  });

  it("purchase: origination assumptions use total loan for points and flat lender fee dollars", () => {
    const { items } = buildCashToCloseLinesPurchase({
      purchasePrice: 715_000,
      loanAmount: 643_500,
      origination: {
        feeBasisTotalLoan: 723_500,
        originationPointsPercent: 0.65,
        originationFlatFee: 1_195,
      },
    });
    expect(items[1]).toMatchObject({
      label: "Estimated points",
      amount: 4_702.75,
    });
    expect(items[2]).toMatchObject({
      label: "Estimated lender fees",
      amount: 1_195,
    });
  });

  it("refinance: exact labels, order, and line 6 equals sum of lines 1–5", () => {
    const { items, estimatedTotal } = buildCashToCloseLinesRefinance({
      referenceAmount: 400_000,
    });
    expect(items.map((i) => i.label)).toEqual([...REFINANCE_LABELS]);
    const sumFirstFive = items
      .slice(0, 5)
      .reduce((s, row) => s + row.amount, 0);
    expect(items[5].amount).toBeCloseTo(sumFirstFive, 10);
    expect(estimatedTotal).toBe(items[5].amount);
  });

  it("refinance: borrower contributes only the payoff gap, while fees use the total loan", () => {
    const { items, estimatedTotal } = buildCashToCloseLinesRefinance({
      referenceAmount: 1_027_500,
      payoffAmount: 978_500,
      initialLoanAmount: 877_500,
      origination: {
        feeBasisTotalLoan: 1_027_500,
        originationPointsPercent: 0.5,
        originationFlatFee: 1_195,
      },
    });
    expect(items[0]).toEqual({ label: "Payoff / unwind amount", amount: 101_000 });
    expect(items[1].amount).toBe(5_137.5);
    expect(items[2].amount).toBe(1_195);
    expect(estimatedTotal).toBe(122_745);
    expect(items[5].amount).toBe(
      items.slice(0, 5).reduce((sum, item) => sum + item.amount, 0),
    );
  });

  it("refinance: a fully funded payoff does not require borrower payoff cash", () => {
    const { items } = buildCashToCloseLinesRefinance({
      referenceAmount: 550_000,
      payoffAmount: 400_000,
      initialLoanAmount: 450_000,
    });
    expect(items[0].amount).toBe(0);
    expect(items[1].amount).toBe(2_750);
  });
});
