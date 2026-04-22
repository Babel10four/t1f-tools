import type { DealAnalyzeRequestV1 } from "./schemas/canonical-request";
import type {
  AnalysisFlag,
  DealAnalyzeResponseV1,
} from "./schemas/canonical-response";
import type { IgnoredRequestFieldNote } from "./legacy/normalizeDealAnalyzeRequest";
import { cashToCloseLinesForPurpose } from "./policy/cashToClose";
import {
  getFallbackPolicySnapshot,
  type DealAnalyzePolicySnapshot,
} from "./policy/policy-snapshot";
import { pricingStatusForSupportedDeal } from "./policy/pricingStatus";
import {
  purchaseBindingFlags,
  purchasePolicyBreakdown,
} from "./policy/purchaseMax";
import { recommendedLoanAmount } from "./policy/recommendedAmount";
import { refinancePolicyMax } from "./policy/refinanceMax";
import { buildDealAnalyzeRisks } from "./policy/risks";
import { supportedProduct } from "./policy/support";
import { applyLoanStructuring } from "./policy/loanStructuring";

function parseNoteRatePercentAssumption(
  assumptions: DealAnalyzeRequestV1["assumptions"],
): number | undefined {
  if (!assumptions) {
    return undefined;
  }
  const v = assumptions.noteRatePercent;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100) {
    return v;
  }
  return undefined;
}

function buildLoanBase(req: DealAnalyzeRequestV1): Omit<
  DealAnalyzeResponseV1["loan"],
  "amount" | "ltv"
> {
  const { deal } = req;
  const base = {
    purpose: deal.purpose,
    productType: deal.productType,
    termMonths: deal.termMonths,
    rehabBudget: deal.rehabBudget,
  };

  if (deal.purpose === "purchase") {
    return {
      ...base,
      purchasePrice: deal.purchasePrice,
    };
  }

  return {
    ...base,
    ...(deal.payoffAmount !== undefined ? { payoffAmount: deal.payoffAmount } : {}),
    ...(deal.requestedLoanAmount !== undefined
      ? { requestedLoanAmount: deal.requestedLoanAmount }
      : {}),
  };
}

function refinanceLtvPercent(loanAmount: number, basis: number): number {
  return Math.round((loanAmount / basis) * 10000) / 100;
}

function purchaseLtvPercent(loanAmount: number, arv: number): number {
  return Math.round((loanAmount / arv) * 10000) / 100;
}

function attachLtv(
  loan: DealAnalyzeResponseV1["loan"],
  req: DealAnalyzeRequestV1,
  refi: ReturnType<typeof refinancePolicyMax>,
): DealAnalyzeResponseV1["loan"] {
  const { deal } = req;
  const amt = loan.amount;

  if (deal.purpose === "refinance" && refi.basis !== undefined && amt !== undefined) {
    if (refi.basis <= 0) {
      return loan;
    }
    return { ...loan, ltv: refinanceLtvPercent(amt, refi.basis) };
  }

  if (deal.purpose === "purchase") {
    const arv = req.property?.arv;
    if (
      amt !== undefined &&
      arv !== undefined &&
      typeof arv === "number" &&
      arv > 0
    ) {
      return { ...loan, ltv: purchaseLtvPercent(amt, arv) };
    }
  }

  return loan;
}

function normalizationNotesToFlags(notes: IgnoredRequestFieldNote[]): AnalysisFlag[] {
  return notes.map((n) => ({
    code: n.code,
    severity: n.severity,
    message: n.message,
    ...(n.context ? { context: n.context } : {}),
  }));
}

function buildAnalysisFlags(
  req: DealAnalyzeRequestV1,
  normalizationNotes: IgnoredRequestFieldNote[],
  extra: AnalysisFlag[],
): { status: "complete" | "incomplete"; flags: AnalysisFlag[] } {
  const flags: AnalysisFlag[] = [
    ...normalizationNotesToFlags(normalizationNotes),
    ...extra,
  ];

  const p = req.property!;
  const hasBothValues =
    p.arv !== undefined &&
    p.asIsValue !== undefined &&
    typeof p.arv === "number" &&
    typeof p.asIsValue === "number";

  if (!hasBothValues) {
    flags.push({
      code: "PROPERTY_CONTEXT_PARTIAL",
      severity: "info",
      message:
        "Only one of ARV or as-is value was provided; v1 stub treats this as partial property context.",
    });
  }

  const missingBorrowerContext =
    !req.borrower ||
    req.borrower.fico === undefined ||
    typeof req.borrower.fico !== "number";

  if (missingBorrowerContext) {
    flags.push({
      code: "BORROWER_CONTEXT_INCOMPLETE",
      severity: "low",
      message:
        "Borrower FICO was not provided; analysis is marked incomplete for v1 stub rules.",
    });
  }

  const incomplete = !hasBothValues || missingBorrowerContext;
  return {
    status: incomplete ? "incomplete" : "complete",
    flags,
  };
}

function unsupportedProductFlag(): AnalysisFlag {
  return {
    code: "UNSUPPORTED_PRODUCT_V1",
    severity: "high",
    message:
      "deal.productType is not supported for v1 policy-backed outputs (bridge_purchase / bridge_refinance only). loan.amount and policy pricing are intentionally withheld.",
  };
}

/** POLICY-ADOPTION-001A — only merged when HTTP opts in and snapshot uses embedded defaults. */
export function policyConfigFallbackAnalysisFlag(): AnalysisFlag {
  return {
    code: "POLICY_CONFIG_FALLBACK",
    severity: "info",
    message:
      "Published calculator_assumptions and/or rates rule_sets were unavailable or invalid; this response used embedded default policy configuration from the deal engine.",
  };
}

function dedupeFlagsByCode(flags: AnalysisFlag[]): AnalysisFlag[] {
  const seen = new Set<string>();
  const out: AnalysisFlag[] = [];
  for (const f of flags) {
    if (seen.has(f.code)) {
      continue;
    }
    seen.add(f.code);
    out.push(f);
  }
  return out;
}

/**
 * Core deal analysis on **normalized canonical** input only.
 * HTTP layer is responsible for normalization + validation.
 */
export async function runDealAnalyze(
  req: DealAnalyzeRequestV1,
  options: {
    normalizationNotes?: IgnoredRequestFieldNote[];
    policySnapshot?: DealAnalyzePolicySnapshot;
    /**
     * When true (POST /api/deal/analyze), emit `POLICY_CONFIG_FALLBACK` if embedded defaults were used.
     * Direct engine tests default to false so snapshots stay stable without HTTP policy resolution.
     */
    includePolicyConfigFallbackFlag?: boolean;
  } = {},
): Promise<DealAnalyzeResponseV1> {
  const normalizationNotes = options.normalizationNotes ?? [];
  const policy =
    options.policySnapshot ?? getFallbackPolicySnapshot();
  const calc = policy.calculator;
  const purchaseCaps = {
    maxLtcPct: calc.maxLtcPct,
    maxArvLtvPct: calc.maxArvLtvPct,
  };
  const { deal } = req;
  const supported = supportedProduct(deal.purpose, deal.productType);

  const purchaseBreakdown =
    supported && deal.purpose === "purchase"
      ? purchasePolicyBreakdown(req, purchaseCaps)
      : undefined;

  const extraFlags: AnalysisFlag[] = [];
  if (
    options.includePolicyConfigFallbackFlag &&
    policy.source === "fallback"
  ) {
    extraFlags.push(policyConfigFallbackAnalysisFlag());
  }
  if (!supported) {
    extraFlags.push(unsupportedProductFlag());
  } else if (purchaseBreakdown) {
    extraFlags.push(
      ...dedupeFlagsByCode(
        purchaseBindingFlags(purchaseBreakdown, purchaseCaps),
      ),
    );
  }

  const { status: analysisStatus, flags: analysisFlags } = buildAnalysisFlags(
    req,
    normalizationNotes,
    extraFlags,
  );

  const refi = refinancePolicyMax(req, calc.refinanceMaxLtvPct);

  if (!supported) {
    const loan: DealAnalyzeResponseV1["loan"] = applyLoanStructuring(
      { ...buildLoanBase(req) },
      req,
    );
    const risks = buildDealAnalyzeRisks(
      {
        supported: false,
        loan,
        policyMax: undefined,
        refi,
        req,
        purchaseBreakdown: undefined,
      },
      {
        maxLtcPct: calc.maxLtcPct,
        ltvOverLimitThresholdPct: calc.ltvOverLimitThresholdPct,
        defaultTermMonths: calc.defaultTermMonths,
      },
    );

    return {
      schemaVersion: "deal_analyze.v1",
      analysis: { status: analysisStatus, flags: analysisFlags },
      loan,
      pricing: {
        status: "stub",
        noteRatePercent: null,
        marginBps: null,
        discountPoints: null,
        lockDays: null,
      },
      cashToClose: {
        status: "stub",
        estimatedTotal: null,
        items: [],
      },
      risks,
    };
  }

  const policyMax =
    deal.purpose === "purchase"
      ? purchaseBreakdown?.policyMax
      : refi.policyMax;

  let loan: DealAnalyzeResponseV1["loan"] = { ...buildLoanBase(req) };

  if (policyMax !== undefined) {
    const amount = recommendedLoanAmount(req, policyMax);
    loan = { ...loan, amount };
  }

  loan = attachLtv(loan, req, refi);
  loan = applyLoanStructuring(loan, req);

  const risks = buildDealAnalyzeRisks(
    {
      supported: true,
      loan,
      policyMax,
      refi,
      req,
      purchaseBreakdown,
    },
    {
      maxLtcPct: calc.maxLtcPct,
      ltvOverLimitThresholdPct: calc.ltvOverLimitThresholdPct,
      defaultTermMonths: calc.defaultTermMonths,
    },
  );

  const pricingStatus = pricingStatusForSupportedDeal({
    policyMaxDefined: policyMax !== undefined,
    borrowerFicoDefined:
      req.borrower?.fico !== undefined && typeof req.borrower.fico === "number",
  });

  let cash: DealAnalyzeResponseV1["cashToClose"];
  if (
    policyMax !== undefined &&
    loan.amount !== undefined &&
    deal.purpose === "purchase" &&
    deal.purchasePrice !== undefined
  ) {
    const built = cashToCloseLinesForPurpose(
      "purchase",
      {
        purchasePrice: deal.purchasePrice,
        loanAmount: loan.amount,
      },
      {
        ctcPointsPct: calc.ctcPointsPct,
        ctcLenderFeesPct: calc.ctcLenderFeesPct,
        ctcClosingCostsPct: calc.ctcClosingCostsPct,
      },
    );
    cash = {
      status: pricingStatus,
      estimatedTotal: built.estimatedTotal,
      items: built.items,
    };
  } else if (
    policyMax !== undefined &&
    loan.amount !== undefined &&
    deal.purpose === "refinance"
  ) {
    const built = cashToCloseLinesForPurpose(
      "refinance",
      {
        referenceAmount: loan.amount,
      },
      {
        ctcPointsPct: calc.ctcPointsPct,
        ctcLenderFeesPct: calc.ctcLenderFeesPct,
        ctcClosingCostsPct: calc.ctcClosingCostsPct,
      },
    );
    cash = {
      status: pricingStatus,
      estimatedTotal: built.estimatedTotal,
      items: built.items,
    };
  } else {
    cash = {
      status: "insufficient_inputs",
      estimatedTotal: null,
      items: [],
    };
  }

  const ratesSlice =
    policy.rates ?? {
      noteRatePercent: null,
      marginBps: null,
      discountPoints: null,
      lockDays: null,
    };

  const noteRateOverride = parseNoteRatePercentAssumption(req.assumptions);

  return {
    schemaVersion: "deal_analyze.v1",
    analysis: { status: analysisStatus, flags: analysisFlags },
    loan,
    pricing: {
      status: pricingStatus,
      noteRatePercent: noteRateOverride ?? ratesSlice.noteRatePercent,
      marginBps: ratesSlice.marginBps,
      discountPoints: ratesSlice.discountPoints,
      lockDays: ratesSlice.lockDays,
    },
    cashToClose: cash,
    risks,
  };
}
