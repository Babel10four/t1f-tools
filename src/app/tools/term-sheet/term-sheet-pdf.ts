import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { TERM_SHEET_DISCLAIMER_DETAILS } from "@/lib/tools/disclaimer-copy";
import { formatNoteRatePercentDisplay } from "../pricing-calculator/pricing-display";
import { formatMoneyWholeDollars } from "../loan-structuring-assistant/display-helpers";
import type { TermSheetLocalMetadata } from "./term-sheet-types";
import {
  buildTermSheetCtcInputRows,
  TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS,
} from "./term-sheet-cash-to-close-fields";
import {
  transformCashToCloseDisplayLines,
} from "../cash-to-close-estimator/cash-to-close-estimator-display";
import { jsPDF } from "jspdf";

const PDF_PAGE_W = 612;
const PAGE_H = 792;
/** Slightly tighter than legacy 48pt — widens the two data columns. */
const MARGIN = 40;
const COL_GAP = 30;
/** Same asset as `T1fTermSheetLogo` / `public/t1f-logo-green.png`. */
const TERM_SHEET_LOGO_PATH = "/t1f-logo-green.png";
const TERM_SHEET_LOGO_PX = { w: 1023, h: 246 };
const TERM_SHEET_LOGO_ASPECT = TERM_SHEET_LOGO_PX.w / TERM_SHEET_LOGO_PX.h;
const BRAND = { r: 40, g: 92, b: 46 };
const TEXT_MUTED = { r: 82, g: 82, b: 82 };
const LINE_GREY = { r: 200, g: 200, b: 200 };

const DISCLAIMER = TERM_SHEET_DISCLAIMER_DETAILS;

const NOTES = [
  "No inspection necessary prior to close if photos are provided",
  "No Prepayment Penalty",
] as const;

const INTEREST_STRUCTURE = "Interest Only Payments";
const HOLDBACK_STRUCTURE =
  "Non-Dutch (Interest not applied until funds are drawn)";

function formatPreparedDate(ymd: string): string {
  const t = ymd.trim();
  if (t === "") {
    return "—";
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) {
    return t;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function purposeLabel(p: string): string {
  switch (p) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    default:
      return p;
  }
}

function initialBasis(
  request: DealAnalyzeRequestV1 | undefined,
): number | undefined {
  if (request?.deal.purchasePrice !== undefined) {
    return request.deal.purchasePrice;
  }
  if (request?.deal.payoffAmount !== undefined) {
    return request.deal.payoffAmount;
  }
  return undefined;
}

function initialAdvancePct(
  request: DealAnalyzeRequestV1 | undefined,
  loan: DealAnalyzeResponseV1["loan"],
): string {
  const basis = initialBasis(request);
  const acq = loan.acquisitionLoanAmount;
  if (basis !== undefined && basis > 0 && acq !== undefined) {
    return `${Math.round((100 * acq) / basis)}%`;
  }
  return "—";
}

function rehabAdvancePct(loan: DealAnalyzeResponseV1["loan"]): string {
  const budget = loan.rehabBudget;
  const rehabLoan = loan.rehabLoanAmount;
  if (budget > 0 && rehabLoan !== undefined) {
    return `${Math.round((100 * rehabLoan) / budget)}%`;
  }
  return "—";
}

function totalPctOfArv(
  request: DealAnalyzeRequestV1 | undefined,
  loan: DealAnalyzeResponseV1["loan"],
): string | undefined {
  const arv = request?.property?.arv;
  const amt = loan.amount;
  if (arv !== undefined && arv > 0 && amt !== undefined) {
    const pct = Math.round((1000 * amt) / arv) / 10;
    return `${pct}%`;
  }
  return undefined;
}

function monthlyInterestOnly(
  principal: number | undefined,
  noteRatePercent: number | null,
): string {
  if (
    principal === undefined ||
    noteRatePercent === null ||
    noteRatePercent === undefined
  ) {
    return "—";
  }
  const m = (principal * (noteRatePercent / 100)) / 12;
  return formatMoneyWholeDollars(Math.round(m * 100) / 100);
}

function originationFeeDollars(
  totalLoan: number | undefined,
  pointsPercent: number | undefined,
): string {
  if (totalLoan === undefined || pointsPercent === undefined) {
    return "—";
  }
  return formatMoneyWholeDollars(
    Math.round(totalLoan * (pointsPercent / 100) * 100) / 100,
  );
}

type Row = { label: string; value: string };

type PdfDoc = InstanceType<typeof jsPDF>;

/** Fallback if the PNG cannot be loaded (offline, bad mock, etc.). */
function drawT1fWordmark(doc: PdfDoc, x: number, yBaseline: number): void {
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(22);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("T1F", x, yBaseline, { angle: -10 });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
}

async function termSheetLogoDataUrl(): Promise<string | null> {
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

function drawKvRow(
  doc: PdfDoc,
  x: number,
  colW: number,
  yTop: number,
  label: string,
  value: string,
): number {
  const labelMax = colW * 0.48;
  const valueMax = colW * 0.48;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  const labelLines = doc.splitTextToSize(label, labelMax);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const valueLines = doc.splitTextToSize(value, valueMax);
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
  return n * lineGap + 10;
}

const TOTAL_CASH_LINE_LABEL = "Total estimated cash to close";

/**
 * Cash-to-close on PDF page 2 (inputs + illustrative breakdown).
 * Returns updated yCursor; may spill slightly if callers add overflow guards later.
 */
function drawCashToCloseSectionPdf(
  doc: PdfDoc,
  yCursor: number,
  request: DealAnalyzeRequestV1 | undefined,
  response: DealAnalyzeResponseV1,
): number {
  let y = yCursor;
  const loan = response.loan;
  const cash = response.cashToClose;
  const purchasePrice = request?.deal.purchasePrice;
  const purpose = loan.purpose === "refinance" ? "refinance" : "purchase";
  const displayLines = transformCashToCloseDisplayLines(cash.items, {
    purpose,
    purchasePrice,
  });

  doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y, PDF_PAGE_W - MARGIN, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Cash to close", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  const subHead = doc.splitTextToSize(
    "Indicative estimate only — not a Closing Disclosure. Assumed title, escrow settlement, hazard insurance, and similar third-party fees are placeholders.",
    PDF_PAGE_W - MARGIN * 2,
  );
  doc.text(subHead, MARGIN, y + 14);
  y += 14 + subHead.length * 11 + 12;

  const fullColW = PDF_PAGE_W - MARGIN * 2;
  const inputRows = buildTermSheetCtcInputRows(request, response);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text("Inputs", MARGIN, y);
  y += 16;
  doc.setTextColor(0, 0, 0);

  for (const r of inputRows) {
    const h = drawKvRow(doc, MARGIN, fullColW, y, r.label, r.value);
    y += Math.max(h, 22);
    if (y > PAGE_H - 220) {
      doc.addPage();
      y = MARGIN;
    }
  }

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text("Estimate", MARGIN, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  const thirdPartyNote = doc.splitTextToSize(
    TERM_SHEET_CTC_THIRD_PARTY_ASSUMPTIONS,
    fullColW,
  );
  doc.text(thirdPartyNote, MARGIN, y);
  y += thirdPartyNote.length * 11 + 10;
  doc.setTextColor(0, 0, 0);

  if (displayLines.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    const msg =
      "No line-by-line cash to close breakdown is shown — complete the relevant purchase or refinance amounts and regenerate, or underwriting may still be finalizing assumptions.";
    const wrapped = doc.splitTextToSize(msg, fullColW);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 12 + 14;
    if (cash.estimatedTotal !== null) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text("Estimated cash to close (total)", MARGIN, y);
      doc.text(
        formatMoneyWholeDollars(cash.estimatedTotal),
        PDF_PAGE_W - MARGIN,
        y,
        { align: "right" },
      );
      y += 22;
    }
    return y;
  }

  const rightAmtX = PDF_PAGE_W - MARGIN;
  const labelWrapW = fullColW * 0.55;
  for (const line of displayLines) {
    const totalRow = line.label === TOTAL_CASH_LINE_LABEL;
    doc.setFont("helvetica", totalRow ? "bold" : "normal");
    doc.setFontSize(totalRow ? 11 : 10);
    doc.setTextColor(0, 0, 0);
    const labelLines = doc.splitTextToSize(line.label, labelWrapW);
    const linePitch = totalRow ? 13 : 12;

    doc.text(labelLines[0]!, MARGIN, y);
    doc.text(
      formatMoneyWholeDollars(line.amount),
      rightAmtX,
      y,
      { align: "right" },
    );
    let innerY = y + linePitch;
    for (let li = 1; li < labelLines.length; li++) {
      doc.text(labelLines[li]!, MARGIN, innerY);
      innerY += linePitch;
    }

    y = Math.max(innerY, y + linePitch) + 2;

    if (line.sublabel) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      const sub = doc.splitTextToSize(line.sublabel, fullColW - 16);
      doc.text(sub, MARGIN + 12, y);
      y += sub.length * 11 + 4;
    }
    if (line.footnote) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
      const fn = doc.splitTextToSize(line.footnote, fullColW - 16);
      doc.text(fn, MARGIN + 12, y);
      y += fn.length * 10 + 6;
    }

    if (y > PAGE_H - 200) {
      doc.addPage();
      y = MARGIN;
    }
  }

  return y;
}

export async function downloadTermSheetPdf(
  metadata: TermSheetLocalMetadata,
  request: DealAnalyzeRequestV1 | undefined,
  response: DealAnalyzeResponseV1,
): Promise<void> {
  const logoData = await termSheetLogoDataUrl();
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const loan = response.loan;
  const pricing = response.pricing;
  const colW = (PDF_PAGE_W - MARGIN * 2 - COL_GAP) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + COL_GAP;
  let y = MARGIN;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);

  const logoH = 28;
  const logoW = logoH * TERM_SHEET_LOGO_ASPECT;
  if (logoData) {
    doc.addImage(logoData, "PNG", leftX, y, logoW, logoH);
  } else {
    drawT1fWordmark(doc, leftX, y + 20);
  }

  const rightBlockX = PDF_PAGE_W - MARGIN;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Tier One Funding Inc", rightBlockX, y + 22, { align: "right" });

  y += 48;
  doc.line(MARGIN, y, PDF_PAGE_W - MARGIN, y);
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Term Sheet", MARGIN, y);
  y += 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(metadata.propertyLabel.trim() || "—", MARGIN, y);
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text(
    `Prepared: ${formatPreparedDate(metadata.preparedDate)}`,
    MARGIN,
    y,
  );
  y += 14;
  if (metadata.preparedBy.trim() !== "") {
    doc.text(`Prepared by: ${metadata.preparedBy.trim()}`, MARGIN, y);
    y += 14;
  }
  doc.setTextColor(0, 0, 0);
  y += 14;

  const inputRows: Row[] = [
    { label: "Transaction Type", value: purposeLabel(loan.purpose) },
  ];
  if (request?.deal.purchasePrice !== undefined) {
    inputRows.push({
      label: "Purchase Price",
      value: formatMoneyWholeDollars(request.deal.purchasePrice),
    });
  }
  if (request?.deal.payoffAmount !== undefined) {
    inputRows.push({
      label: "Payoff Amount",
      value: formatMoneyWholeDollars(request.deal.payoffAmount),
    });
  }
  inputRows.push({
    label: "Rehab Amount",
    value: formatMoneyWholeDollars(request?.deal.rehabBudget ?? loan.rehabBudget),
  });
  if (request?.property?.arv !== undefined) {
    inputRows.push({
      label: "ARV",
      value: formatMoneyWholeDollars(request.property.arv),
    });
  }
  inputRows.push({
    label: "Acquisition Funds",
    value: initialAdvancePct(request, loan),
  });
  inputRows.push({ label: "Rehab Funds", value: rehabAdvancePct(loan) });
  if (loan.originationPointsPercent !== undefined) {
    inputRows.push({
      label: "Lender points",
      value: formatNoteRatePercentDisplay(loan.originationPointsPercent),
    });
  }
  inputRows.push({
    label: "Rate",
    value: formatNoteRatePercentDisplay(pricing.noteRatePercent),
  });
  inputRows.push({
    label: "Term",
    value:
      loan.termMonths === null || loan.termMonths === undefined
        ? "—"
        : `${loan.termMonths} months`,
  });
  if (loan.originationFlatFee !== undefined) {
    inputRows.push({
      label: "Lender loan fee",
      value: formatMoneyWholeDollars(loan.originationFlatFee),
    });
  }

  const basisLabel =
    request?.deal.purchasePrice !== undefined
      ? "Purchase Price"
      : request?.deal.payoffAmount !== undefined
        ? "Payoff"
        : "Basis";
  const initialPct = initialAdvancePct(request, loan);
  const initialLoanLabel =
    initialPct !== "—" && initialBasis(request) !== undefined
      ? `Acquisition Funds (${initialPct} of ${basisLabel})`
      : "Acquisition Funds";

  const totalPct = totalPctOfArv(request, loan);
  const totalLoanLabel =
    totalPct !== undefined
      ? `Total Loan (${totalPct} of ARV)`
      : "Total Loan";

  const pts = loan.originationPointsPercent;
  const originationLabel =
    pts !== undefined
      ? `Origination from points (${formatNoteRatePercentDisplay(pts)})`
      : "Origination from points";

  const rateForPayment = pricing.noteRatePercent;
  const termsRows: Row[] = [];
  if (loan.acquisitionLoanAmount !== undefined) {
    termsRows.push({
      label: initialLoanLabel,
      value: formatMoneyWholeDollars(loan.acquisitionLoanAmount),
    });
  }
  if (loan.rehabLoanAmount !== undefined) {
    termsRows.push({
      label: "Rehab Loan",
      value: formatMoneyWholeDollars(loan.rehabLoanAmount),
    });
  }
  if (loan.amount !== undefined) {
    termsRows.push({
      label: totalLoanLabel,
      value: formatMoneyWholeDollars(loan.amount),
    });
  }
  if (pts !== undefined && loan.amount !== undefined) {
    termsRows.push({
      label: originationLabel,
      value: originationFeeDollars(loan.amount, pts),
    });
  }
  if (loan.originationFlatFee !== undefined) {
    termsRows.push({
      label: "Lender loan fee",
      value: formatMoneyWholeDollars(loan.originationFlatFee),
    });
  }
  const rateLabel = formatNoteRatePercentDisplay(pricing.noteRatePercent);
  const beforeLabel = `Monthly Payment (Before Rehab Drawn) @ ${rateLabel}`;
  const afterLabel = `Monthly Payment (After Rehab Drawn) @ ${rateLabel}`;
  termsRows.push({
    label: beforeLabel,
    value: monthlyInterestOnly(loan.acquisitionLoanAmount, rateForPayment),
  });
  termsRows.push({
    label: afterLabel,
    value: monthlyInterestOnly(loan.amount, rateForPayment),
  });
  termsRows.push({
    label: "Loan Term",
    value:
      loan.termMonths === null || loan.termMonths === undefined
        ? "—"
        : `${loan.termMonths} months`,
  });
  termsRows.push({
    label: "Interest Structure",
    value: INTEREST_STRUCTURE,
  });
  termsRows.push({
    label: "Holdback Structure",
    value: HOLDBACK_STRUCTURE,
  });

  const headerY = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text("Inputs", leftX, headerY);
  doc.text("Terms Offered", rightX, headerY);
  doc.setTextColor(0, 0, 0);
  let yCursor = headerY + 22;

  const maxRows = Math.max(inputRows.length, termsRows.length);
  for (let i = 0; i < maxRows; i++) {
    if (yCursor > PAGE_H - 120) {
      break;
    }
    let h = 14;
    if (i < inputRows.length) {
      const r = inputRows[i]!;
      h = drawKvRow(doc, leftX, colW, yCursor, r.label, r.value);
    }
    if (i < termsRows.length) {
      const r = termsRows[i]!;
      const hr = drawKvRow(doc, rightX, colW, yCursor, r.label, r.value);
      h = Math.max(h, hr);
    }
    yCursor += Math.max(h, 24);
  }

  yCursor += 12;
  doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
  doc.line(MARGIN, yCursor, PDF_PAGE_W - MARGIN, yCursor);
  yCursor += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  for (const note of NOTES) {
    doc.text(note, MARGIN, yCursor);
    yCursor += 14;
  }

  doc.addPage();
  yCursor = MARGIN;
  yCursor = drawCashToCloseSectionPdf(doc, yCursor, request, response);
  yCursor += 20;

  if (yCursor > PAGE_H - 260) {
    doc.addPage();
    yCursor = MARGIN;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(2);
  doc.line(MARGIN, yCursor, PDF_PAGE_W - MARGIN, yCursor);
  yCursor += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  for (const line of DISCLAIMER) {
    const wrapped = doc.splitTextToSize(line, PDF_PAGE_W - MARGIN * 2);
    doc.text(wrapped, MARGIN, yCursor);
    yCursor += wrapped.length * 11 + 4;
  }
  yCursor += 24;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared By:", MARGIN, yCursor);
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN + 78, yCursor - 2, MARGIN + 280, yCursor - 2);
  doc.text("Date:", MARGIN + 300, yCursor);
  doc.line(MARGIN + 330, yCursor - 2, PDF_PAGE_W - MARGIN, yCursor - 2);
  yCursor += 28;
  doc.text("Accepted By:", MARGIN, yCursor);
  doc.line(MARGIN + 88, yCursor - 2, MARGIN + 280, yCursor - 2);
  doc.text("Date:", MARGIN + 300, yCursor);
  doc.line(MARGIN + 330, yCursor - 2, PDF_PAGE_W - MARGIN, yCursor - 2);
  yCursor += 36;
  doc.setDrawColor(LINE_GREY.r, LINE_GREY.g, LINE_GREY.b);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, yCursor, PDF_PAGE_W - MARGIN, yCursor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text("v1", PDF_PAGE_W / 2, PAGE_H - 52, { align: "center" });

  const raw =
    metadata.propertyLabel.trim().replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-") ||
    "term-sheet";
  doc.save(`${raw.slice(0, 64)}-term-sheet.pdf`);
}
