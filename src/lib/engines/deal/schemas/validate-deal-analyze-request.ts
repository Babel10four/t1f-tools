import type { DealAnalyzeRequestV1 } from "./canonical-request";
import type { ValidationIssue } from "./validation-issue";
import type { UnknownRecord } from "@/lib/engines/types";

/** Must match `DEAL_ALYZE_SCHEMA_VERSION` in `./deal-analyze-constants` (inline for reliable test runtime). */
const DEAL_ALYZE_SCHEMA_VERSION = "deal_analyze.v1" as const;
const DEAL_PURPOSES = ["purchase", "refinance"] as const;

/** Explicit 400 codes from BUILD SPEC — TICKET-001 (+ TICKET-001A schema rules). */
export type DealAnalyzeRequestErrorCode =
  | "INVALID_JSON"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "MISSING_DEAL"
  | "MISSING_PURPOSE"
  | "MISSING_PRODUCT_TYPE"
  | "MISSING_PURCHASE_PRICE"
  | "MISSING_REFI_AMOUNT"
  | "MISSING_COLLATERAL_VALUE";

export type ValidateDealAnalyzeFailure = {
  ok: false;
  code: DealAnalyzeRequestErrorCode;
  message: string;
  issues: ValidationIssue[];
};

export type ValidateDealAnalyzeSuccess = {
  ok: true;
  value: DealAnalyzeRequestV1;
};

export type ValidateDealAnalyzeResult =
  | ValidateDealAnalyzeSuccess
  | ValidateDealAnalyzeFailure;

function fail(
  code: DealAnalyzeRequestErrorCode,
  message: string,
  issues: ValidationIssue[] = [],
): ValidateDealAnalyzeFailure {
  return { ok: false, code, message, issues };
}

function isPlainObject(v: unknown): v is UnknownRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFinitePositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function isFiniteNonNegNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function isPurpose(v: unknown): v is (typeof DEAL_PURPOSES)[number] {
  return (
    typeof v === "string" && (DEAL_PURPOSES as readonly string[]).includes(v)
  );
}

/**
 * Validates normalized canonical shape (numeric fields already numbers on canonical path).
 * Call after `normalizeDealAnalyzeRequest`.
 */
export function validateDealAnalyzeRequestV1(
  input: UnknownRecord,
): ValidateDealAnalyzeResult {
  if (!isPlainObject(input)) {
    return fail("INVALID_JSON", "Request body must be a JSON object.", []);
  }

  if (input.schemaVersion === undefined) {
    return fail(
      "UNSUPPORTED_SCHEMA_VERSION",
      "`schemaVersion` is required.",
      [],
    );
  }
  if (input.schemaVersion === null) {
    return fail(
      "UNSUPPORTED_SCHEMA_VERSION",
      "`schemaVersion` cannot be null.",
      [{ path: "schemaVersion", message: "Expected a non-null string." }],
    );
  }
  if (typeof input.schemaVersion !== "string") {
    return fail(
      "UNSUPPORTED_SCHEMA_VERSION",
      "`schemaVersion` must be a string.",
      [{ path: "schemaVersion", message: "Must be the literal string deal_analyze.v1." }],
    );
  }
  if (input.schemaVersion !== DEAL_ALYZE_SCHEMA_VERSION) {
    return fail(
      "UNSUPPORTED_SCHEMA_VERSION",
      `schemaVersion must be exactly "${DEAL_ALYZE_SCHEMA_VERSION}".`,
      [
        {
          path: "schemaVersion",
          message: `Got "${input.schemaVersion}".`,
        },
      ],
    );
  }

  if (!isPlainObject(input.deal) || Object.keys(input.deal).length === 0) {
    return fail(
      "MISSING_DEAL",
      "`deal` is required and must be a non-empty object.",
      [],
    );
  }

  const deal = input.deal;

  if (!("purpose" in deal) || deal.purpose === undefined || deal.purpose === null) {
    return fail("MISSING_PURPOSE", "`deal.purpose` is required.", []);
  }
  if (!isPurpose(deal.purpose)) {
    return fail(
      "MISSING_PURPOSE",
      "`deal.purpose` must be \"purchase\" or \"refinance\".",
      [{ path: "deal.purpose", message: "Invalid enum value." }],
    );
  }

  const productType =
    typeof deal.productType === "string" ? deal.productType.trim() : "";
  if (!productType) {
    return fail(
      "MISSING_PRODUCT_TYPE",
      "`deal.productType` is required and must be non-empty.",
      [{ path: "deal.productType", message: "Must be a non-empty string." }],
    );
  }

  if (deal.purpose === "purchase") {
    if (!isFinitePositiveNumber(deal.purchasePrice)) {
      return fail(
        "MISSING_PURCHASE_PRICE",
        "For purchase, `deal.purchasePrice` must be a finite number greater than zero.",
        [{ path: "deal.purchasePrice", message: "Must be a finite JSON number > 0." }],
      );
    }
    if (
      "requestedLoanAmount" in deal &&
      deal.requestedLoanAmount !== undefined &&
      !isFinitePositiveNumber(deal.requestedLoanAmount)
    ) {
      return fail(
        "INVALID_JSON",
        "For purchase, `deal.requestedLoanAmount` must be a finite number greater than zero when provided.",
        [{ path: "deal.requestedLoanAmount", message: "Must be a finite JSON number > 0." }],
      );
    }
  }

  if (deal.purpose === "refinance") {
    const hasPayoff = isFinitePositiveNumber(deal.payoffAmount);
    const hasRequested = isFinitePositiveNumber(deal.requestedLoanAmount);
    if (!hasPayoff && !hasRequested) {
      return fail(
        "MISSING_REFI_AMOUNT",
        "For refinance, at least one of `deal.payoffAmount` or `deal.requestedLoanAmount` must be a finite number greater than zero.",
        [],
      );
    }
  }

  if ("rehabBudget" in deal && deal.rehabBudget !== undefined) {
    if (!isFiniteNonNegNumber(deal.rehabBudget)) {
      return fail(
        "INVALID_JSON",
        "`deal.rehabBudget` must be a finite non-negative number when provided.",
        [{ path: "deal.rehabBudget", message: "Must be a JSON number." }],
      );
    }
  }

  if ("termMonths" in deal && deal.termMonths !== undefined && deal.termMonths !== null) {
    if (!isFiniteNonNegNumber(deal.termMonths)) {
      return fail(
        "INVALID_JSON",
        "`deal.termMonths` must be a non-negative finite number or null.",
        [{ path: "deal.termMonths", message: "Must be a JSON number or null." }],
      );
    }
  }

  const property = input.property;
  let arv: number | undefined;
  let asIs: number | undefined;
  if (property !== undefined) {
    if (!isPlainObject(property)) {
      return fail(
        "MISSING_COLLATERAL_VALUE",
        "`property` must be an object when provided.",
        [{ path: "property", message: "Expected an object." }],
      );
    }
    if ("arv" in property && property.arv !== undefined) {
      if (!isFinitePositiveNumber(property.arv)) {
        return fail(
          "MISSING_COLLATERAL_VALUE",
          "`property.arv` must be a finite number greater than zero when provided.",
          [{ path: "property.arv", message: "Must be a finite JSON number > 0." }],
        );
      }
      arv = property.arv;
    }
    if ("asIsValue" in property && property.asIsValue !== undefined) {
      if (!isFinitePositiveNumber(property.asIsValue)) {
        return fail(
          "MISSING_COLLATERAL_VALUE",
          "`property.asIsValue` must be a finite number greater than zero when provided.",
          [
            {
              path: "property.asIsValue",
              message: "Must be a finite JSON number > 0.",
            },
          ],
        );
      }
      asIs = property.asIsValue;
    }
  }

  if (arv === undefined && asIs === undefined) {
    return fail(
      "MISSING_COLLATERAL_VALUE",
      "At least one of `property.arv` or `property.asIsValue` is required as a finite number greater than zero.",
      [],
    );
  }

  let borrower: DealAnalyzeRequestV1["borrower"];
  if (input.borrower !== undefined) {
    if (!isPlainObject(input.borrower)) {
      return fail(
        "INVALID_JSON",
        "`borrower` must be an object when provided.",
        [{ path: "borrower", message: "Expected an object." }],
      );
    }
    const b = input.borrower;
    if ("fico" in b && b.fico !== undefined) {
      if (!isFiniteNonNegNumber(b.fico) || b.fico > 850) {
        return fail(
          "INVALID_JSON",
          "`borrower.fico` must be between 0 and 850 when provided.",
          [{ path: "borrower.fico", message: "Must be a JSON number." }],
        );
      }
    }
    borrower = {
      ...(typeof b.fico === "number" ? { fico: b.fico } : {}),
      ...(typeof b.experienceTier === "string" && b.experienceTier.trim() !== ""
        ? { experienceTier: b.experienceTier.trim() }
        : {}),
    };
    if (Object.keys(borrower).length === 0) {
      borrower = undefined;
    }
  }

  const rehabBudget =
    "rehabBudget" in deal && deal.rehabBudget !== undefined
      ? (deal.rehabBudget as number)
      : 0;

  const termMonths =
    deal.termMonths === undefined || deal.termMonths === null
      ? null
      : (deal.termMonths as number);

  const value: DealAnalyzeRequestV1 = {
    schemaVersion: "deal_analyze.v1",
    deal: {
      purpose: deal.purpose,
      productType,
      ...(deal.purpose === "purchase"
        ? {
            purchasePrice: deal.purchasePrice as number,
            ...(isFinitePositiveNumber(deal.requestedLoanAmount)
              ? { requestedLoanAmount: deal.requestedLoanAmount }
              : {}),
          }
        : {}),
      ...(deal.purpose === "refinance"
        ? {
            ...(isFinitePositiveNumber(deal.payoffAmount)
              ? { payoffAmount: deal.payoffAmount }
              : {}),
            ...(isFinitePositiveNumber(deal.requestedLoanAmount)
              ? { requestedLoanAmount: deal.requestedLoanAmount }
              : {}),
          }
        : {}),
      rehabBudget,
      termMonths,
    },
    ...(arv !== undefined || asIs !== undefined
      ? {
          property: {
            ...(arv !== undefined ? { arv } : {}),
            ...(asIs !== undefined ? { asIsValue: asIs } : {}),
          },
        }
      : {}),
    ...(borrower ? { borrower } : {}),
    ...(isPlainObject(input.assumptions)
      ? { assumptions: input.assumptions }
      : {}),
  };

  return { ok: true, value };
}
