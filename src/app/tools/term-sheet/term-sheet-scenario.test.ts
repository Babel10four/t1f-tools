import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import { runDealAnalyze } from "@/lib/engines/deal/analyze";
import { buildTermSheetPlainText } from "./term-sheet-plain-text";
import { downloadTermSheetPdf } from "./term-sheet-pdf";
import { termSheetScenarioBasis } from "./term-sheet-scenario";

const pdf = vi.hoisted(() => ({
  text: vi.fn(),
  splitTextToSize: vi.fn((text: string) => [text]),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  save: vi.fn(),
}));

vi.mock("jspdf", () => ({ jsPDF: vi.fn(function () { return pdf; }) }));

// Synthetic rounded fixture, not a borrower record.
const request: DealAnalyzeRequestV1 = {
  schemaVersion: "deal_analyze.v1",
  deal: {
    purpose: "refinance",
    productType: "bridge_refinance",
    payoffAmount: 700_000,
    requestedLoanAmount: 900_000,
    rehabBudget: 200_000,
    termMonths: 12,
  },
  property: { asIsValue: 1_000_000, arv: 1_400_000 },
  borrower: { experienceTier: "1" },
  assumptions: { borrowingRehabFunds: true, noteRatePercent: 10, originationPointsPercent: 0.5 },
  programContext: { scenario: "refinance_seasoned" },
};
const metadata = {
  internalDealLabel: "",
  counterpartyLabel: "",
  propertyLabel: "Synthetic seasoned refinance",
  preparedBy: "",
  preparedDate: "2026-10-26",
};

describe("explicit term-sheet refinance scenario basis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("labels the selected basis and preserved rehab split in plain text", async () => {
    const response = await runDealAnalyze(request);
    const text = buildTermSheetPlainText(metadata, request, response, "2026-11-09");
    expect(text).toContain(`Selected scenario: ${termSheetScenarioBasis(request)}`);
    expect(text).toContain("70% ARV total-loan cap including rehab holdback");
    expect(text).toContain("subject to underwriting verification");
    expect(text).toContain("Acquisition funds: $700,000");
    expect(text).toContain("Rehab loan: $200,000");
    expect(text).toContain("Total loan: $900,000");
    expect(text).toContain("Lender points: 0.5%");
    expect(text).toContain("Rate: 10%");
  });

  it("renders the same explicit basis in the PDF without replacing financial terms", async () => {
    const response = await runDealAnalyze(request);
    await downloadTermSheetPdf(metadata, request, response, "2026-11-09");
    const expected = `Selected scenario: ${termSheetScenarioBasis(request)}`;
    expect(pdf.splitTextToSize).toHaveBeenCalledWith(expected, 532);
    expect(pdf.text).toHaveBeenCalledWith([expected], 40, 40);
    const textCalls = pdf.text.mock.calls.flat().join(" ");
    expect(textCalls).toContain("$700,000");
    expect(textCalls).toContain("$200,000");
    expect(textCalls).toContain("$900,000");
    expect(pdf.save).toHaveBeenCalledOnce();
  });

  it("does not add a seasoned basis to generic refinance or purchase outputs", async () => {
    const generic = { ...request, programContext: undefined };
    expect(termSheetScenarioBasis(generic)).toBeUndefined();
    expect(termSheetScenarioBasis({ ...request, deal: { ...request.deal, purpose: "purchase" } })).toBeUndefined();
    expect(termSheetScenarioBasis(undefined)).toBeUndefined();
    const response = await runDealAnalyze(generic);
    expect(buildTermSheetPlainText(metadata, generic, response)).not.toContain("Selected scenario:");
    await downloadTermSheetPdf(metadata, generic, response);
    expect(pdf.text.mock.calls.flat().join(" ")).not.toContain("Selected scenario:");
  });
});
