/**
 * Borrower-facing Pricing Comparison PDF (one-pager). Mirrors the look of `term-sheet-pdf.ts`
 * (green logo with wordmark fallback, brand colors, two-column table). Internal-only figures are
 * already excluded by the shared row builders in `pricing-comparison-export.ts`.
 */

import { jsPDF } from "jspdf";
import { PRICING_COMPARISON_DISCLAIMER } from "@/lib/tools/disclaimer-copy";
import {
  buildPricingComparisonLoanInfoRows,
  buildPricingComparisonSavingsRows,
  buildPricingComparisonSideRows,
  COMPETITOR_LABEL,
  T1F_LABEL,
  type PricingComparisonExportInput,
} from "./pricing-comparison-export";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const TERM_SHEET_LOGO_PATH = "/t1f-logo-green.png";
const TERM_SHEET_LOGO_PX = { w: 1023, h: 246 };
const TERM_SHEET_LOGO_ASPECT = TERM_SHEET_LOGO_PX.w / TERM_SHEET_LOGO_PX.h;
const BRAND = { r: 40, g: 92, b: 46 };
const TEXT_MUTED = { r: 82, g: 82, b: 82 };
const LINE_GREY = { r: 200, g: 200, b: 200 };

type PdfDoc = InstanceType<typeof jsPDF>;

function drawT1fWordmark(doc: PdfDoc, x: number, yBaseline: number): void {
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(22);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("T1F", x, yBaseline, { angle: -10 });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(TERM_SHEET_LOGO_PATH);
    if (!res.ok) {
      return null;
    }
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Right-aligned value, left label, within [x, x+colW]. Returns row height used. */
function drawKvRow(
  doc: PdfDoc,
  x: number,
  colW: number,
  yTop: number,
  label: string,
  value: string,
): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  const labelLines = doc.splitTextToSize(label, colW * 0.6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const valueLines = doc.splitTextToSize(value, colW * 0.38);
  const n = Math.max(labelLines.length, valueLines.length);
  const lineGap = 13;
  for (let i = 0; i < n; i++) {
    const yy = yTop + i * lineGap;
    if (labelLines[i]) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      doc.text(labelLines[i]!, x, yy);
    }
    if (valueLines[i]) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(valueLines[i]!, x + colW, yy, { align: "right" });
    }
  }
  return n * lineGap + 8;
}

export async function downloadPricingComparisonPdf(
  input: PricingComparisonExportInput,
): Promise<void> {
  const { result } = input;
  const logoData = await logoDataUrl();
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const logoH = 28;
  const logoW = logoH * TERM_SHEET_LOGO_ASPECT;
  if (logoData) {
    doc.addImage(logoData, "PNG", MARGIN, y, logoW, logoH);
  } else {
    drawT1fWordmark(doc, MARGIN, y + 20);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Tier One Funding Inc", PAGE_W - MARGIN, y + 22, { align: "right" });

  y += 48;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Pricing Comparison", MARGIN, y);
  y += 24;

  // Loan information
  const loanInfoRows = buildPricingComparisonLoanInfoRows(input);
  const fullColW = PAGE_W - MARGIN * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text("Loan information", MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += 18;
  for (const row of loanInfoRows) {
    const h = drawKvRow(doc, MARGIN, fullColW, y, row.label, row.value);
    y += Math.max(h, 20);
  }

  y += 8;
  doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 22;

  // Two-column comparison
  const colGap = 30;
  const colW = (PAGE_W - MARGIN * 2 - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + colGap;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(T1F_LABEL, leftX, y);
  doc.setTextColor(0, 0, 0);
  doc.text(COMPETITOR_LABEL, rightX, y);
  y += 18;

  const t1fRows = buildPricingComparisonSideRows(result.t1f, input.t1fRatePercent);
  const compRows = buildPricingComparisonSideRows(
    result.competitor,
    input.competitorRatePercent,
  );
  const maxRows = Math.max(t1fRows.length, compRows.length);
  let yCursor = y;
  for (let i = 0; i < maxRows; i++) {
    let h = 18;
    if (i < t1fRows.length) {
      const r = t1fRows[i]!;
      h = drawKvRow(doc, leftX, colW, yCursor, r.label, r.value);
    }
    if (i < compRows.length) {
      const r = compRows[i]!;
      const hr = drawKvRow(doc, rightX, colW, yCursor, r.label, r.value);
      h = Math.max(h, hr);
    }
    yCursor += Math.max(h, 22);
  }
  y = yCursor + 4;

  // Savings highlight
  doc.setDrawColor(110, 231, 183);
  doc.setLineWidth(1.5);
  doc.setFillColor(236, 253, 245);
  const savingsRows = buildPricingComparisonSavingsRows(result);
  const boxH = savingsRows.length * 22 + 16;
  doc.roundedRect(MARGIN, y, fullColW, boxH, 6, 6, "FD");
  let sy = y + 22;
  for (const row of savingsRows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 83, 45);
    doc.text(row.label, MARGIN + 12, sy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(row.value, PAGE_W - MARGIN - 12, sy, { align: "right" });
    sy += 22;
  }
  y += boxH + 24;

  if (y > PAGE_H - 140) {
    doc.addPage();
    y = MARGIN;
  }

  // Disclaimer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  for (const line of PRICING_COMPARISON_DISCLAIMER) {
    const wrapped = doc.splitTextToSize(line, fullColW);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 11 + 4;
  }

  doc.save("pricing-comparison.pdf");
}
