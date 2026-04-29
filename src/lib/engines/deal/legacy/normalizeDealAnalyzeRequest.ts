import type { UnknownRecord } from "@/lib/engines/types";

export type IgnoredRequestFieldNote = {
  code: "IGNORED_REQUEST_OUTPUT_FIELDS";
  severity: "info";
  message: string;
  context?: Record<string, unknown>;
};

function isPlainObject(v: unknown): v is UnknownRecord {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Coerce numeric strings only on the legacy `loan` subtree (TICKET-001A). */
function coerceLegacyScalar(v: unknown): unknown {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return v;
}

function coerceLegacyNumericFieldsInPlace(
  obj: UnknownRecord,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (!(key in obj) || obj[key] === undefined) {
      continue;
    }
    if (key === "termMonths") {
      const v = obj[key];
      if (v === null) {
        obj[key] = null;
        continue;
      }
      obj[key] = coerceLegacyScalar(v);
      continue;
    }
    obj[key] = coerceLegacyScalar(obj[key]);
  }
}

function mergeDealFromLegacyLoan(
  deal: UnknownRecord,
  loan: UnknownRecord,
): void {
  const take = (fromKey: string, toKey: string) => {
    if (!(toKey in deal) || deal[toKey] === undefined) {
      if (fromKey in loan && loan[fromKey] !== undefined) {
        deal[toKey] = coerceLegacyScalar(loan[fromKey]);
      }
    }
  };
  take("purpose", "purpose");
  take("productType", "productType");
  take("product", "productType");
  take("purchasePrice", "purchasePrice");
  take("payoffAmount", "payoffAmount");
  take("requestedLoanAmount", "requestedLoanAmount");
  take("rehabBudget", "rehabBudget");
  take("termMonths", "termMonths");

  const purpose = deal.purpose;

  if (
    (purpose === "purchase" || purpose === undefined) &&
    deal.purchasePrice === undefined
  ) {
    if (loan.purchasePrice !== undefined) {
      deal.purchasePrice = coerceLegacyScalar(loan.purchasePrice);
    } else if (loan.amount !== undefined) {
      deal.purchasePrice = coerceLegacyScalar(loan.amount);
    } else if (loan.loanAmount !== undefined) {
      deal.purchasePrice = coerceLegacyScalar(loan.loanAmount);
    }
  }

  if (purpose === "refinance" || purpose === undefined) {
    if (deal.requestedLoanAmount === undefined) {
      if (loan.amount !== undefined) {
        deal.requestedLoanAmount = coerceLegacyScalar(loan.amount);
      } else if (loan.loanAmount !== undefined) {
        deal.requestedLoanAmount = coerceLegacyScalar(loan.loanAmount);
      }
    }
  }
}

/**
 * Maps legacy `loan` into `deal` / `property` / `borrower`.
 * Numeric-string coercion applies **only** to values read from the `loan` subtree (TICKET-001A).
 * Does **not** default `schemaVersion`.
 */
export function normalizeDealAnalyzeRequest(raw: UnknownRecord): {
  normalized: UnknownRecord;
  notes: IgnoredRequestFieldNote[];
} {
  const notes: IgnoredRequestFieldNote[] = [];

  if ("pricing" in raw && raw.pricing !== undefined) {
    notes.push({
      code: "IGNORED_REQUEST_OUTPUT_FIELDS",
      severity: "info",
      message:
        "Request `pricing` is not an authoritative input on deal_analyze.v1; request values were ignored for computation.",
      context: { path: "pricing" },
    });
  }
  if ("cashToClose" in raw && raw.cashToClose !== undefined) {
    notes.push({
      code: "IGNORED_REQUEST_OUTPUT_FIELDS",
      severity: "info",
      message:
        "Request `cashToClose` is not an authoritative input on deal_analyze.v1; request values were ignored for computation.",
      context: { path: "cashToClose" },
    });
  }

  const loanTop = isPlainObject(raw.loan) ? raw.loan : null;
  const legacyPath = loanTop !== null;

  let deal: UnknownRecord | undefined;
  if (isPlainObject(raw.deal)) {
    if (Object.keys(raw.deal).length === 0 && !loanTop) {
      deal = undefined;
    } else {
      deal = { ...raw.deal };
    }
  }
  if (loanTop) {
    if (!deal) {
      deal = {};
    }
    mergeDealFromLegacyLoan(deal, loanTop);
  }

  if (deal) {
    if (!deal.productType && typeof raw.product === "string") {
      deal.productType = raw.product;
    }

    if (
      !legacyPath &&
      (deal.purpose === "refinance" || deal.purpose === undefined) &&
      deal.requestedLoanAmount === undefined &&
      typeof raw.loanAmount === "number" &&
      Number.isFinite(raw.loanAmount)
    ) {
      deal.requestedLoanAmount = raw.loanAmount;
    }

    if (deal.rehabBudget === undefined) {
      deal.rehabBudget = 0;
    }

    if (deal.termMonths === undefined) {
      deal.termMonths = null;
    }
  }

  let property: UnknownRecord | undefined;
  if (isPlainObject(raw.property)) {
    property = { ...raw.property };
  } else if (loanTop && isPlainObject(loanTop.property)) {
    property = { ...loanTop.property };
    coerceLegacyNumericFieldsInPlace(property, ["arv", "asIsValue"]);
  }

  let borrower: UnknownRecord | undefined;
  if (isPlainObject(raw.borrower)) {
    borrower = { ...raw.borrower };
  } else if (loanTop && isPlainObject(loanTop.borrower)) {
    borrower = { ...loanTop.borrower };
    coerceLegacyNumericFieldsInPlace(borrower, ["fico"]);
  }

  const normalized: UnknownRecord = {
    schemaVersion: raw.schemaVersion,
    ...(deal !== undefined ? { deal } : {}),
    ...(property ? { property } : {}),
    ...(borrower ? { borrower } : {}),
    ...(isPlainObject(raw.assumptions)
      ? { assumptions: raw.assumptions }
      : {}),
    ...(isPlainObject(raw.programContext)
      ? { programContext: raw.programContext }
      : {}),
  };

  return { normalized, notes };
}
