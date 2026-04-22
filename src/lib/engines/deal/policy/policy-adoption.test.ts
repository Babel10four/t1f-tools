import { describe, expect, it } from "vitest";
import { policyConfigFallbackAnalysisFlag, runDealAnalyze } from "../analyze";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import {
  getFallbackPolicySnapshot,
  parseCalculatorAssumptionsRecord,
  type DealAnalyzePolicySnapshot,
} from "./policy-snapshot";
import {
  POLICY_CTC_CLOSING_COSTS_PCT,
  POLICY_CTC_LENDER_FEES_PCT,
  POLICY_CTC_POINTS_PCT,
  POLICY_DEFAULT_TERM_MONTHS,
  POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  POLICY_REFINANCE_MAX_LTV_PCT,
} from "./constants";

const minimalPurchase: DealAnalyzeRequestV1 = {
  schemaVersion: "deal_analyze.v1",
  deal: {
    purpose: "purchase",
    productType: "bridge_purchase",
    purchasePrice: 350_000,
    termMonths: null,
    rehabBudget: 0,
  },
  property: { asIsValue: 400_000 },
};

function fullCalculatorFromConstants() {
  return {
    maxLtcPct: POLICY_MAX_LTC_PCT,
    maxArvLtvPct: POLICY_MAX_ARV_LTV_PCT,
    refinanceMaxLtvPct: POLICY_REFINANCE_MAX_LTV_PCT,
    defaultTermMonths: POLICY_DEFAULT_TERM_MONTHS,
    ltvOverLimitThresholdPct: POLICY_LTV_OVER_LIMIT_THRESHOLD_PCT,
    ctcPointsPct: POLICY_CTC_POINTS_PCT,
    ctcLenderFeesPct: POLICY_CTC_LENDER_FEES_PCT,
    ctcClosingCostsPct: POLICY_CTC_CLOSING_COSTS_PCT,
  };
}

describe("POLICY-ADOPTION-001", () => {
  it("fallback snapshot matches prior purchase policy max (350k → 262_500)", async () => {
    const res = await runDealAnalyze(minimalPurchase, {
      policySnapshot: getFallbackPolicySnapshot(),
    });
    expect(res.loan.amount).toBe(262_500);
    expect(res.pricing.noteRatePercent).toBeNull();
    expect(res.cashToClose.estimatedTotal).toBe(98_000);
  });

  it("runDealAnalyze without policySnapshot uses fallback and matches same numerics", async () => {
    const a = await runDealAnalyze(minimalPurchase, {
      policySnapshot: getFallbackPolicySnapshot(),
    });
    const b = await runDealAnalyze(minimalPurchase);
    expect(b.loan.amount).toBe(a.loan.amount);
    expect(b.cashToClose.estimatedTotal).toBe(a.cashToClose.estimatedTotal);
  });

  it("published snapshot with lower maxLtcPct reduces loan.amount predictably", async () => {
    const snap: DealAnalyzePolicySnapshot = {
      source: "published",
      calculator: { ...fullCalculatorFromConstants(), maxLtcPct: 0.5 },
      rates: null,
    };
    const res = await runDealAnalyze(minimalPurchase, { policySnapshot: snap });
    expect(res.loan.amount).toBe(175_000);
  });

  it("published snapshot with higher CTC multipliers changes cash-to-close totals (labels unchanged)", async () => {
    const snap: DealAnalyzePolicySnapshot = {
      source: "published",
      calculator: {
        ...fullCalculatorFromConstants(),
        ctcPointsPct: 0.01,
        ctcLenderFeesPct: 0.02,
        ctcClosingCostsPct: 0.03,
      },
      rates: null,
    };
    const res = await runDealAnalyze(minimalPurchase, { policySnapshot: snap });
    expect(res.cashToClose.items?.[1].label).toBe("Estimated points");
    expect(res.cashToClose.items?.[1].amount).toBe(3500);
    expect(res.cashToClose.estimatedTotal).toBe(108_500);
  });

  it("published rates populate pricing scalars without changing request shape", async () => {
    const snap: DealAnalyzePolicySnapshot = {
      source: "published",
      calculator: fullCalculatorFromConstants(),
      rates: {
        noteRatePercent: 8.125,
        marginBps: 250,
        discountPoints: 1.25,
        lockDays: 45,
      },
    };
    const res = await runDealAnalyze(minimalPurchase, { policySnapshot: snap });
    expect(res.pricing.noteRatePercent).toBe(8.125);
    expect(res.pricing.marginBps).toBe(250);
    expect(res.pricing.discountPoints).toBe(1.25);
    expect(res.pricing.lockDays).toBe(45);
  });

  it("parseCalculatorAssumptionsRecord rejects incomplete or invalid assumptions", () => {
    expect(parseCalculatorAssumptionsRecord({ maxLtcPct: 0.75 })).toBeNull();
    expect(
      parseCalculatorAssumptionsRecord({
        maxLtcPct: 2,
        maxArvLtvPct: 0.7,
        refinanceMaxLtvPct: 0.75,
        defaultTermMonths: 12,
        ltvOverLimitThresholdPct: 75,
        ctcPointsPct: 0.005,
        ctcLenderFeesPct: 0.01,
        ctcClosingCostsPct: 0.015,
      }),
    ).toBeNull();
  });

  it("parseCalculatorAssumptionsRecord accepts full valid assumption set", () => {
    const r = parseCalculatorAssumptionsRecord({
      maxLtcPct: 0.75,
      maxArvLtvPct: 0.7,
      refinanceMaxLtvPct: 0.75,
      defaultTermMonths: 12,
      ltvOverLimitThresholdPct: 75,
      ctcPointsPct: 0.005,
      ctcLenderFeesPct: 0.01,
      ctcClosingCostsPct: 0.015,
    });
    expect(r).not.toBeNull();
    expect(r!.maxLtcPct).toBe(0.75);
  });

  it("POLICY-ADOPTION-001A: emits POLICY_CONFIG_FALLBACK only when HTTP flag opt-in and source fallback", async () => {
    const published: DealAnalyzePolicySnapshot = {
      source: "published",
      calculator: fullCalculatorFromConstants(),
      rates: null,
    };
    const withPublished = await runDealAnalyze(minimalPurchase, {
      policySnapshot: published,
      includePolicyConfigFallbackFlag: true,
    });
    expect(
      withPublished.analysis.flags.some((f) => f.code === "POLICY_CONFIG_FALLBACK"),
    ).toBe(false);

    const withFallback = await runDealAnalyze(minimalPurchase, {
      policySnapshot: getFallbackPolicySnapshot(),
      includePolicyConfigFallbackFlag: true,
    });
    const fb = withFallback.analysis.flags.filter(
      (f) => f.code === "POLICY_CONFIG_FALLBACK",
    );
    expect(fb).toHaveLength(1);
    expect(fb[0]).toMatchObject({
      severity: "info",
      code: "POLICY_CONFIG_FALLBACK",
      message: policyConfigFallbackAnalysisFlag().message,
    });
  });

  it("POLICY-ADOPTION-001A: direct engine calls omit fallback flag by default", async () => {
    const res = await runDealAnalyze(minimalPurchase, {
      policySnapshot: getFallbackPolicySnapshot(),
    });
    expect(
      res.analysis.flags.some((f) => f.code === "POLICY_CONFIG_FALLBACK"),
    ).toBe(false);
  });
});
