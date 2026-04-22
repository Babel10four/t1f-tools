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
});
