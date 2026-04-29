import type {
  LoanAssistantFields,
  LoanAssistantFlow,
} from "../loan-structuring-assistant/build-deal-analyze-request";

/** Tab session only — cleared when the tab closes or the user clears the session. */
export const DEAL_FORM_SESSION_STORAGE_KEY = "t1f_deal_form_session_v1";

export const DEAL_FORM_SESSION_CHANGED_EVENT = "t1f:deal-form-session-changed";

export const DEFAULT_DEAL_FORM_FIELDS: LoanAssistantFields = {
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  requestedLoanAmount: "",
  termMonths: "",
  fico: "",
  experienceTier: "",
  payoffAmount: "",
  asIsValue: "",
  borrowingRehabFunds: "yes",
  originationPointsPercent: "",
  originationFlatFee: "",
  noteRatePercent: "",
  collateralPropertyAddress: "",
};

export type DealFormSessionPayload = {
  flow: LoanAssistantFlow;
  fields: LoanAssistantFields;
};

function isLoanAssistantFlow(v: unknown): v is LoanAssistantFlow {
  return v === "purchase" || v === "refinance";
}

function isBorrowingRehabFunds(v: unknown): v is LoanAssistantFields["borrowingRehabFunds"] {
  return v === "yes" || v === "no";
}

function parseFields(raw: unknown): LoanAssistantFields | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const strings = [
    "purchasePrice",
    "rehabBudget",
    "arv",
    "requestedLoanAmount",
    "termMonths",
    "fico",
    "experienceTier",
    "payoffAmount",
    "asIsValue",
    "originationPointsPercent",
    "originationFlatFee",
    "noteRatePercent",
  ] as const;
  for (const k of strings) {
    if (typeof o[k] !== "string") {
      return null;
    }
  }
  if (!isBorrowingRehabFunds(o.borrowingRehabFunds)) {
    return null;
  }
  const collateralPropertyAddress =
    typeof o.collateralPropertyAddress === "string" ? o.collateralPropertyAddress : "";
  return {
    purchasePrice: o.purchasePrice as string,
    rehabBudget: o.rehabBudget as string,
    arv: o.arv as string,
    requestedLoanAmount: o.requestedLoanAmount as string,
    termMonths: o.termMonths as string,
    fico: o.fico as string,
    experienceTier: o.experienceTier as string,
    payoffAmount: o.payoffAmount as string,
    asIsValue: o.asIsValue as string,
    borrowingRehabFunds: o.borrowingRehabFunds,
    originationPointsPercent: o.originationPointsPercent as string,
    originationFlatFee: o.originationFlatFee as string,
    noteRatePercent: o.noteRatePercent as string,
    collateralPropertyAddress,
  };
}

export function loadDealFormSession(): DealFormSessionPayload | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(DEAL_FORM_SESSION_STORAGE_KEY);
    if (!raw?.trim()) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (!isLoanAssistantFlow(o.flow)) {
      return null;
    }
    const fields = parseFields(o.fields);
    if (!fields) {
      return null;
    }
    return { flow: o.flow, fields };
  } catch {
    return null;
  }
}

export function writeDealFormSession(payload: DealFormSessionPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      DEAL_FORM_SESSION_STORAGE_KEY,
      JSON.stringify(payload),
    );
    window.dispatchEvent(new Event(DEAL_FORM_SESSION_CHANGED_EVENT));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearDealFormSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(DEAL_FORM_SESSION_STORAGE_KEY);
    window.dispatchEvent(new Event(DEAL_FORM_SESSION_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
