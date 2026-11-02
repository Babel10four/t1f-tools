import { describe, expect, it } from "vitest";
import { runDealAnalyze } from "./analyze";
import { applyLoanStructuring } from "./policy/loanStructuring";
import { getFallbackPolicySnapshot, type DealAnalyzePolicySnapshot } from "./policy/policy-snapshot";
import { resolvePurchaseTierRule, VERIFIED_TIER4_PURCHASE_POLICY } from "./policy/purchaseTierRule";
import type { DealAnalyzeRequestV1 } from "./schemas/canonical-request";

function policy(): DealAnalyzePolicySnapshot {
  const fallback = getFallbackPolicySnapshot();
  return {
    ...fallback,
    source: "published",
    calculator: {
      ...fallback.calculator,
      purchaseTierRules: {
        "3": { initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 },
      },
    },
  };
}

function request(tier: string | undefined = "4"): DealAnalyzeRequestV1 {
  return {
    schemaVersion: "deal_analyze.v1",
    deal: { purpose: "purchase", productType: "bridge_purchase", purchasePrice: 160_000, rehabBudget: 60_000, termMonths: 12 },
    property: { asIsValue: 160_000, arv: 275_000 },
    borrower: { experienceTier: tier, fico: 740 },
    assumptions: { borrowingRehabFunds: true, noteRatePercent: 9.5, originationPointsPercent: 0, originationFlatFee: 2_300 },
  };
}

describe("all-or-none rehab funding", () => {
  it.each(["1", "2", "3", "4", "5"])("keeps full rehab when the ARV cap binds for tier %s", async (tier) => {
    const req = request(tier);
    req.property!.arv = 200_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    const amount = tier === "4" || tier === "5" ? 140_000 : 150_000;
    expect(out.loan).toMatchObject({ amount, acquisitionLoanAmount: amount - 60_000, rehabLoanAmount: 60_000 });
    expect(out.loan.acquisitionLoanAmount! + out.loan.rehabLoanAmount!).toBe(out.loan.amount);
  });

  it.each(["1", "2", "3", "4", "5"])("keeps full rehab when the request is lower for tier %s", async (tier) => {
    const req = request(tier);
    req.deal.requestedLoanAmount = 100_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 100_000, acquisitionLoanAmount: 40_000, rehabLoanAmount: 60_000 });
  });

  it.each(["1", "2", "3", "4", "5"])("funds zero rehab when declined for tier %s", async (tier) => {
    const req = request(tier);
    req.assumptions!.borrowingRehabFunds = false;
    req.deal.requestedLoanAmount = 100_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 100_000, acquisitionLoanAmount: 100_000, rehabLoanAmount: 0 });
  });

  it.each(["1", "2", "3", "4", "5"])("withholds infeasible requested funding for tier %s", async (tier) => {
    const req = request(tier);
    req.deal.requestedLoanAmount = 59_999.99;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.acquisitionLoanAmount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.pricing.status).toBe("needs_review");
    expect(out.analysis.flags.find((flag) => flag.code === "PURCHASE_REHAB_HOLDBACK_SHORTFALL")?.context)
      .toEqual({ availableLoanAmount: 59_999.99, requiredRehabHoldback: 60_000 });
  });

  it.each(["1", "2", "3", "4", "5"])("withholds an ARV cap below full rehab for tier %s", async (tier) => {
    const req = request(tier);
    req.property!.arv = 50_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.flags.some((flag) => flag.code === "PURCHASE_REHAB_HOLDBACK_SHORTFALL")).toBe(true);
  });

  it("withholds an ordinary refinance request below full rehab", async () => {
    const req = request();
    req.deal = { purpose: "refinance", productType: "bridge_refinance", payoffAmount: 50_000, rehabBudget: 60_000, requestedLoanAmount: 59_000, termMonths: 12 };
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.pricing.status).toBe("needs_review");
    expect(out.analysis.flags.some((flag) => flag.code === "REFINANCE_REHAB_HOLDBACK_SHORTFALL")).toBe(true);
  });

  it("defensively withholds infeasible allocations outside the main analyze path", () => {
    const req = request();
    const out = applyLoanStructuring({ purpose: "purchase", productType: "bridge_purchase", amount: 59_000, ltv: 21.45, termMonths: 12, rehabBudget: 60_000 }, req);
    expect(out.amount).toBeUndefined();
    expect(out.ltv).toBeUndefined();
    expect(out.ltcPercent).toBeUndefined();
    expect(out.rehabLoanAmount).toBeUndefined();
  });

  it.each([0, 0.75])("withholds a published rehab rule of %s when full rehab is selected", async (rehabAdvancePct) => {
    const snapshot = policy();
    snapshot.calculator.purchaseTierRules!["4"] = { initialAdvancePct: 0.75, rehabAdvancePct, maxArvLtvPct: 0.7 };
    const out = await runDealAnalyze(request(), { policySnapshot: snapshot });
    expect(out.loan.amount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.pricing.status).toBe("needs_review");
    expect(out.analysis.flags.some((flag) => flag.code === "PURCHASE_REHAB_POLICY_UNAVAILABLE")).toBe(true);
  });
});

describe("source-verified Tier 4 purchase sizing", () => {
  it.each([275_000, 280_000])("sizes Isacc's deal with ARV %s at 75% initial acquisition plus full rehab", async (arv) => {
    const req = request();
    req.property!.arv = arv;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 180_000, acquisitionLoanAmount: 120_000, rehabLoanAmount: 60_000, bindingLeg: "advance_sum" });
    expect(out.analysis.flags.find((flag) => flag.code === "VERIFIED_TIER4_PURCHASE_POLICY")?.context).toEqual(VERIFIED_TIER4_PURCHASE_POLICY);
  });

  it("reduces initial acquisition, not rehab, when Tier 4's 70% ARV cap binds", async () => {
    const req = request();
    req.property!.arv = 250_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 175_000, acquisitionLoanAmount: 115_000, rehabLoanAmount: 60_000, ltv: 70, bindingLeg: "arv_ltv" });
  });

  it("retains a lower requested total but preserves the whole rehab holdback", async () => {
    const req = request();
    req.deal.requestedLoanAmount = 165_000;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 165_000, acquisitionLoanAmount: 105_000, rehabLoanAmount: 60_000 });
  });

  it("does not include declined rehab in the Tier 4 policy maximum", async () => {
    const req = request();
    req.assumptions!.borrowingRehabFunds = false;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 120_000, acquisitionLoanAmount: 120_000, rehabLoanAmount: 0 });
  });

  it("lets a valid published Tier 4 rule supersede the verified fallback", async () => {
    const snapshot = policy();
    snapshot.calculator.purchaseTierRules!["4"] = { initialAdvancePct: 0.8, rehabAdvancePct: 1, maxArvLtvPct: 0.7 };
    const out = await runDealAnalyze(request(), { policySnapshot: snapshot });
    expect(out.loan).toMatchObject({ amount: 188_000, acquisitionLoanAmount: 128_000, rehabLoanAmount: 60_000 });
    expect(out.analysis.flags.some((flag) => flag.code === "VERIFIED_TIER4_PURCHASE_POLICY")).toBe(false);
    expect(resolvePurchaseTierRule(undefined, "Tier 4")).toEqual({ initialAdvancePct: 0.75, rehabAdvancePct: 1, maxArvLtvPct: 0.7 });
  });
});
