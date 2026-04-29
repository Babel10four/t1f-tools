import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import { DEAL_ANALYZE_SCHEMA_VERSION } from "@/lib/engines/deal/schemas/deal-analyze-constants";

export type LoanAssistantFlow = "purchase" | "refinance";

/** Controlled form strings; numbers only on the wire after parse. */
export type LoanAssistantFields = {
  purchasePrice: string;
  rehabBudget: string;
  arv: string;
  requestedLoanAmount: string;
  termMonths: string;
  fico: string;
  experienceTier: string;
  payoffAmount: string;
  asIsValue: string;
  /** When "no", the full approved loan is treated as acquisition; rehab loan is zero. */
  borrowingRehabFunds: "yes" | "no";
  /** Percent points (e.g. 0.65 for 0.65%). */
  originationPointsPercent: string;
  /** Flat lender / loan fee in dollars. */
  originationFlatFee: string;
  /** Indicative note rate (%), 0–100; sent as `assumptions.noteRatePercent`. */
  noteRatePercent: string;
  /**
   * Optional subject property mailing-style address for admin analytics only
   * (`assumptions.collateralPropertyAddress`); not used by the deal engine.
   */
  collateralPropertyAddress: string;
};

const MAX_COLLATERAL_ADDRESS_CHARS = 500;

function buildAssumptions(
  fields: LoanAssistantFields,
): Record<string, unknown> | undefined {
  const assumptions: Record<string, unknown> = {
    borrowingRehabFunds: fields.borrowingRehabFunds === "yes",
  };
  const addr = fields.collateralPropertyAddress.trim();
  if (addr !== "") {
    assumptions.collateralPropertyAddress = addr.slice(0, MAX_COLLATERAL_ADDRESS_CHARS);
  }
  const points = parseNonNegNumber(fields.originationPointsPercent);
  if (points !== undefined) {
    assumptions.originationPointsPercent = points;
  }
  const fee = parseNonNegNumber(fields.originationFlatFee);
  if (fee !== undefined) {
    assumptions.originationFlatFee = fee;
  }
  const noteRate = parseNoteRatePercent(fields.noteRatePercent);
  if (noteRate !== undefined) {
    assumptions.noteRatePercent = noteRate;
  }
  return assumptions;
}

function parsePositiveNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === "") {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    return undefined;
  }
  return n;
}

function parseNonNegNumber(s: string): number | undefined {
  const t = s.trim();
  if (t === "") {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return undefined;
  }
  return n;
}

function parseNoteRatePercent(s: string): number | undefined {
  const t = s.trim();
  if (t === "") {
    return undefined;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return undefined;
  }
  return n;
}

function parseTermMonths(s: string): number | null {
  const t = s.trim();
  if (t === "") {
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

export type BuildRequestResult =
  | { ok: true; request: DealAnalyzeRequestV1 }
  | { ok: false; clientHint: string };

/**
 * Serialize the form into the frozen canonical request shape (TICKET-003).
 * Returns a client-side hint when required fields are missing (non-blocking elsewhere).
 */
export function buildDealAnalyzeRequest(
  flow: LoanAssistantFlow,
  fields: LoanAssistantFields,
): BuildRequestResult {
  const termMonths = parseTermMonths(fields.termMonths);

  const borrower: NonNullable<DealAnalyzeRequestV1["borrower"]> = {};
  const fico = parsePositiveNumber(fields.fico);
  if (fico !== undefined) {
    borrower.fico = fico;
  }
  const tier = fields.experienceTier.trim();
  if (tier !== "") {
    borrower.experienceTier = tier;
  }
  const hasBorrower = Object.keys(borrower).length > 0;

  if (flow === "purchase") {
    const purchasePrice = parsePositiveNumber(fields.purchasePrice);
    if (purchasePrice === undefined) {
      return {
        ok: false,
        clientHint:
          "Purchase price is required and must be a positive number.",
      };
    }
    const rehab = parseNonNegNumber(fields.rehabBudget);
    const rehabBudget = rehab === undefined ? 0 : rehab;
    const requestedLoanAmount = parsePositiveNumber(fields.requestedLoanAmount);
    const deal: DealAnalyzeRequestV1["deal"] = {
      purpose: "purchase",
      productType: "bridge_purchase",
      purchasePrice,
      rehabBudget,
      termMonths,
    };
    if (requestedLoanAmount !== undefined) {
      deal.requestedLoanAmount = requestedLoanAmount;
    }

    const property: NonNullable<DealAnalyzeRequestV1["property"]> = {};
    const arv = parsePositiveNumber(fields.arv);
    if (arv !== undefined) {
      property.arv = arv;
    }
    const hasProperty = Object.keys(property).length > 0;

    const request: DealAnalyzeRequestV1 = {
      schemaVersion: DEAL_ANALYZE_SCHEMA_VERSION,
      deal,
      assumptions: buildAssumptions(fields),
      ...(hasProperty ? { property } : {}),
      ...(hasBorrower ? { borrower } : {}),
    };
    return { ok: true, request };
  }

  const payoffAmount = parsePositiveNumber(fields.payoffAmount);
  const requestedLoanAmount = parsePositiveNumber(fields.requestedLoanAmount);
  if (payoffAmount === undefined && requestedLoanAmount === undefined) {
    return {
      ok: false,
      clientHint:
        "Enter at least one of payoff amount or requested loan amount (positive numbers).",
    };
  }

  const rehab = parseNonNegNumber(fields.rehabBudget);
  const rehabBudget = rehab === undefined ? 0 : rehab;

  const deal: DealAnalyzeRequestV1["deal"] = {
    purpose: "refinance",
    productType: "bridge_refinance",
    rehabBudget,
    termMonths,
  };
  if (payoffAmount !== undefined) {
    deal.payoffAmount = payoffAmount;
  }
  if (requestedLoanAmount !== undefined) {
    deal.requestedLoanAmount = requestedLoanAmount;
  }

  const property: NonNullable<DealAnalyzeRequestV1["property"]> = {};
  const asIsValue = parsePositiveNumber(fields.asIsValue);
  if (asIsValue !== undefined) {
    property.asIsValue = asIsValue;
  }
  const arv = parsePositiveNumber(fields.arv);
  if (arv !== undefined) {
    property.arv = arv;
  }
  const hasProperty = Object.keys(property).length > 0;

  const request: DealAnalyzeRequestV1 = {
    schemaVersion: DEAL_ANALYZE_SCHEMA_VERSION,
    deal,
    assumptions: buildAssumptions(fields),
    ...(hasProperty ? { property } : {}),
    ...(hasBorrower ? { borrower } : {}),
  };
  return { ok: true, request };
}
