import { describe, expect, it } from "vitest";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildTermSheetCtcEstimateRows,
  termSheetCtcPerDiemClosingNote,
} from "./term-sheet-cash-to-close-fields";

function purchaseResponse(): DealAnalyzeResponseV1 {
  return {
    loan: { purpose: "purchase", amount: 90_000, acquisitionLoanAmount: 80_000 },
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
}

describe("termSheetCtcPerDiemClosingNote", () => {
  it("names the supplied closing date", () => {
    expect(termSheetCtcPerDiemClosingNote(new Date(2026, 5, 15))).toContain(
      "closing date of Jun 15, 2026",
    );
  });

  it("falls back to 'today' when no date is supplied", () => {
    expect(termSheetCtcPerDiemClosingNote()).toContain("closing date of today");
  });
});

describe("buildTermSheetCtcEstimateRows", () => {
  it("uses the supplied closing date for partial-month interest", () => {
    // May 8, 2026 -> 24 inclusive days through month-end at $20/day per diem + $600 first month.
    const rows = buildTermSheetCtcEstimateRows(
      purchaseResponse(),
      new Date(2026, 4, 8),
    );
    const interest = rows.find((r) => r.label === "Interest costs");
    expect(interest?.value).toBe("$1,080");
    const detail = rows.find((r) => r.label === "Interest calc detail");
    expect(detail?.value).toContain("24 days");
  });
});
