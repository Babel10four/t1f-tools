import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1, DealAnalyzeRiskV1 } from "../schemas/canonical-response";
import {
  POLICY_DEFAULT_TERM_MONTHS,
  POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
  POLICY_MAX_LTC_PCT,
} from "./constants";
import type { PurchasePolicyBreakdown } from "./purchaseMax";
import type { RefinancePolicyMaxResult } from "./refinanceMax";

function defaultPolicyTerms(): {
  maxLtcPct: number;
  ltvOverLimitThresholdPct: number;
  defaultTermMonths: number;
} {
  return {
    maxLtcPct: POLICY_MAX_LTC_PCT,
    ltvOverLimitThresholdPct: POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
    defaultTermMonths: POLICY_DEFAULT_TERM_MONTHS,
  };
}

function fmtMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Stable `risks[]` for deal analyze — codes only from
 * `DEAL_ANALYZE_STABLE_RISK_CODES` / business-rules.
 */
export function buildDealAnalyzeRisks(
  input: {
    supported: boolean;
    loan: DealAnalyzeLoanOutV1;
    policyMax: number | undefined;
    refi: RefinancePolicyMaxResult;
    req: DealAnalyzeRequestV1;
    /** Supported purchase LTC breakdown when basis is positive (TICKET-002A). */
    purchaseBreakdown?: PurchasePolicyBreakdown | undefined;
  },
  policyTerms: {
    maxLtcPct: number;
    ltvOverLimitThresholdPct: number;
    defaultTermMonths: number;
  } = defaultPolicyTerms(),
): DealAnalyzeRiskV1[] {
  const risks: DealAnalyzeRiskV1[] = [];
  const { maxLtcPct, ltvOverLimitThresholdPct, defaultTermMonths } =
    policyTerms;
  const { supported, loan, policyMax, refi, req, purchaseBreakdown } = input;

  if (!supported) {
    risks.push({
      code: "UNSUPPORTED_PRODUCT_V1",
      severity: "high",
      title: "Product not supported on v1 policy surface",
      detail:
        "This deal.productType is not in the supported v1 set (bridge_purchase / bridge_refinance). Outputs are not policy-backed; do not treat amounts or pricing as authoritative.",
    });
    return risks;
  }

  if (req.deal.purpose === "refinance" && policyMax === undefined) {
    risks.push({
      code: "MISSING_COLLATERAL_VALUE",
      severity: "high",
      title: "Refinance collateral basis indeterminate",
      detail:
        "Neither as-is value nor ARV yields a positive collateral basis under frozen precedence; policy max was not computed.",
    });
    return risks;
  }

  if (
    req.borrower?.fico === undefined ||
    typeof req.borrower.fico !== "number"
  ) {
    risks.push({
      code: "MISSING_BORROWER_PRICING_INPUT",
      severity: "medium",
      title: "Borrower inputs incomplete for pricing",
      detail:
        "FICO was not provided; pricing fields remain non-authoritative until inputs are complete.",
    });
  }

  const ask = req.deal.requestedLoanAmount;
  if (
    policyMax !== undefined &&
    ask !== undefined &&
    typeof ask === "number" &&
    ask > policyMax
  ) {
    risks.push({
      code: "REQUEST_EXCEEDS_POLICY_MAX",
      severity: "medium",
      title: "Requested amount exceeds policy maximum",
      detail: `Requested ${ask} exceeds policy max ${policyMax}; loan.amount is capped to policy max.`,
    });
  }

  const ltcAsk = req.deal.requestedLoanAmount;
  if (
    purchaseBreakdown !== undefined &&
    ltcAsk !== undefined &&
    typeof ltcAsk === "number" &&
    ltcAsk > purchaseBreakdown.ltcCap
  ) {
    const basis = purchaseBreakdown.basis;
    const ltcCap = purchaseBreakdown.ltcCap;
    const tier12 = purchaseBreakdown.tier12AdvanceRule === true;
    const detail = tier12
      ? `Requested amount ${fmtMoney(ltcAsk)} exceeds the advance-sum maximum ${fmtMoney(ltcCap)} (90% of purchase + 100% of rehab before ARV cap; cost basis ${fmtMoney(basis)}). The recommended amount is capped; confirm leverage with capital policy.`
      : `Requested amount ${fmtMoney(ltcAsk)} exceeds the LTC-based maximum ${fmtMoney(ltcCap)} (${maxLtcPct} of cost basis ${fmtMoney(basis)}). The recommended amount is capped; confirm leverage with capital policy.`;
    risks.push({
      code: "LTC_OVER_LIMIT",
      severity: "high",
      title: "Requested loan exceeds LTC limit",
      detail,
    });
  }

  if (
    refi.basisSource === "arv" &&
    (req.property?.asIsValue === undefined || req.property.asIsValue <= 0)
  ) {
    risks.push({
      code: "VALUE_BASIS_ASSUMED",
      severity: "low",
      title: "Refinance basis used ARV",
      detail:
        "As-is value was not available; ARV was used as the refinance collateral basis per frozen precedence.",
    });
  }

  if (
    loan.ltv !== undefined &&
    loan.ltv > ltvOverLimitThresholdPct
  ) {
    risks.push({
      code: "LTV_OVER_LIMIT",
      severity: "high",
      title: "LTV above policy threshold",
      detail: `loan.ltv is ${loan.ltv}% (0–100 scale), above ${ltvOverLimitThresholdPct}% policy screen.`,
    });
  }

  if (
    req.deal.termMonths !== null &&
    req.deal.termMonths !== defaultTermMonths
  ) {
    risks.push({
      code: "TERM_OUT_OF_RANGE",
      severity: "low",
      title: "Term differs from v1 default",
      detail: `deal.termMonths is ${String(req.deal.termMonths)}; policy default is ${defaultTermMonths} months for v1 assumptions.`,
    });
  }

  return risks;
}
