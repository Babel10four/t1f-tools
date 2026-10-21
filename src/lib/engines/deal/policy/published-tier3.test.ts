import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateRulePayload } from "@/lib/rule-sets/validate-payload";
import { runDealAnalyze } from "../analyze";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import { computeInitialLtcPercent, initialLtcDescription } from "./initial-ltc-display";
import { getFallbackPolicySnapshot, parseCalculatorAssumptionsRecord, type DealAnalyzePolicySnapshot } from "./policy-snapshot";
import { resolvePurchaseTierRule } from "./purchaseTierRule";

const tier3Rule = { initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 };

function policy(): DealAnalyzePolicySnapshot {
  // Exercise the exact publication payload, not a separate test-only policy copy.
  const raw = JSON.parse(readFileSync(join(process.cwd(), "docs/operations/tier3-purchase-policy-2026-10-21.json"), "utf8"));
  const validated = validateRulePayload("calculator_assumptions", raw);
  if (!validated.ok || !("assumptions" in validated.payload)) {
    throw new Error("Checked-in Tier 3 publication payload is invalid");
  }
  const calculator = parseCalculatorAssumptionsRecord(validated.payload.assumptions, validated.payload.purchaseTierRules);
  if (!calculator) throw new Error("Checked-in calculator assumptions could not be parsed");
  return {
    source: "published",
    calculator,
    rates: null,
  };
}

function request(ask = 493_250): DealAnalyzeRequestV1 {
  return {
    schemaVersion: "deal_analyze.v1",
    deal: {
      purpose: "purchase", productType: "bridge_purchase", purchasePrice: 517_500,
      rehabBudget: 27_500, requestedLoanAmount: ask, termMonths: 12,
    },
    property: { arv: 680_000 },
    borrower: { experienceTier: "3" },
    assumptions: { borrowingRehabFunds: true, noteRatePercent: 9.5, originationPointsPercent: 0.6, originationFlatFee: 1195 },
  };
}

describe("published Tier 3 purchase policy regression", () => {
  it("sizes Kayla's example at 85% acquisition plus full rehab, with correct presentation", async () => {
    const req = request();
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({
      amount: 467_375, acquisitionLoanAmount: 439_875, rehabLoanAmount: 27_500,
      ltv: 68.73, ltcPercent: 85.76, bindingLeg: "advance_sum",
    });
    expect(computeInitialLtcPercent(req, out.loan)).toBe(85);
    expect(initialLtcDescription(req)).toContain("purchase price");
    expect(out.analysis.flags.find((f) => f.code === "PURCHASE_POLICY_MAX_BINDS_LTC")?.message).toContain("85% of purchase + 100% of financed rehab");
    const capContext = out.analysis.flags.find((f) => f.code === "PURCHASE_POLICY_MAX_BINDS_LTC")?.context;
    expect(capContext).toMatchObject({ initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75, purchaseTier: "3" });
    expect(capContext).not.toHaveProperty("maxLtcPct");
    expect(out.risks.find((r) => r.code === "LTC_OVER_LIMIT")?.detail).toContain("85% of purchase + 100% of financed rehab");
    expect(out.risks.some((r) => r.code === "VALUE_BASIS_ASSUMED")).toBe(false);
    expect(out.analysis.flags.some((f) => f.code === "BORROWER_CONTEXT_INCOMPLETE")).toBe(true);
    expect(out.analysis.status).toBe("incomplete");
  });

  it("honors the lower manual request without prorating the rehab holdback", async () => {
    const out = await runDealAnalyze(request(467_300), { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 467_300, acquisitionLoanAmount: 439_800, rehabLoanAmount: 27_500 });
  });

  it("honors a low request while preserving the entire holdback", async () => {
    const out = await runDealAnalyze(request(400_000), { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 400_000, acquisitionLoanAmount: 372_500, rehabLoanAmount: 27_500 });
  });

  it.each([20_000, 0])("withholds a request of %s that cannot cover the full SOW holdback", async (ask) => {
    const out = await runDealAnalyze(request(ask), { policySnapshot: policy() });
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.pricing.status).toBe("needs_review");
    expect(out.analysis.flags.find((f) => f.code === "PURCHASE_REHAB_HOLDBACK_SHORTFALL")?.severity).toBe("high");
  });

  it("withholds an ARV-capped total that cannot cover the full SOW holdback", async () => {
    const req = request();
    req.property = { arv: 20_000 };
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan.amount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.flags.some((f) => f.code === "PURCHASE_REHAB_HOLDBACK_SHORTFALL")).toBe(true);
  });

  it("applies the configured 75% ARV cap before preserving rehab holdback", async () => {
    const req = request();
    req.property = { arv: 600_000 };
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 450_000, acquisitionLoanAmount: 422_500, rehabLoanAmount: 27_500, bindingLeg: "arv_ltv", ltv: 75 });
    expect(out.analysis.flags.find((f) => f.code === "PURCHASE_POLICY_MAX_BINDS_ARV")?.message).toContain("75% of ARV for tier 3");
  });

  it("rounds component caps and allocation consistently to cents", async () => {
    const req = request();
    req.deal.purchasePrice = 100_000.03;
    req.deal.rehabBudget = 10_000.01;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 95_000.04, acquisitionLoanAmount: 85_000.03, rehabLoanAmount: 10_000.01 });
  });

  it("does not include declined rehab funding in the policy maximum", async () => {
    const req = request();
    req.assumptions!.borrowingRehabFunds = false;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 439_875, acquisitionLoanAmount: 439_875, rehabLoanAmount: 0 });
  });

  it("uses the published mapping rather than hardcoded Tier 3 percentages", async () => {
    const changed = policy();
    changed.calculator.purchaseTierRules = { "3": { ...tier3Rule, initialAdvancePct: 0.8 } };
    const out = await runDealAnalyze(request(), { policySnapshot: changed });
    expect(out.loan).toMatchObject({ amount: 441_500, acquisitionLoanAmount: 414_000, rehabLoanAmount: 27_500 });
  });

  it.each(["fallback", "published"] as const)("withholds Tier 3 sizing when %s config lacks its rule", async (source) => {
    const missing = { ...getFallbackPolicySnapshot(), source };
    const req = request();
    req.borrower = { experienceTier: "Tier 3", fico: 740 };
    req.property!.asIsValue = 517_500;
    const out = await runDealAnalyze(req, { policySnapshot: missing, includePolicyConfigFallbackFlag: true });
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.acquisitionLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.flags.some((f) => f.code === "PURCHASE_TIER_POLICY_UNAVAILABLE")).toBe(true);
    expect(out.analysis.status).toBe("incomplete");
    expect(out.pricing.status).toBe("needs_review");
  });

  it.each(["1", "Tier 2"])("preserves legacy %s behavior", async (tier) => {
    const req = request();
    req.borrower!.experienceTier = tier;
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 493_250, acquisitionLoanAmount: 465_750, rehabLoanAmount: 27_500 });
  });

  it("preserves the refinance rehab-first allocation", async () => {
    const req = request();
    req.deal = { purpose: "refinance", productType: "bridge_refinance", payoffAmount: 978_500, rehabBudget: 150_000, requestedLoanAmount: 1_027_500, termMonths: 12 };
    req.property = { asIsValue: 1_370_000 };
    const out = await runDealAnalyze(req, { policySnapshot: policy() });
    expect(out.loan).toMatchObject({ amount: 1_027_500, acquisitionLoanAmount: 877_500, rehabLoanAmount: 150_000 });
  });

  it("normalizes numeric and Tier labels without inventing a fallback rule", () => {
    expect(resolvePurchaseTierRule(policy().calculator, " Tier 3 ")).toEqual(tier3Rule);
    expect(resolvePurchaseTierRule(undefined, "3")).toBeUndefined();
    expect(resolvePurchaseTierRule(undefined, "2")).toEqual({ initialAdvancePct: 0.9, rehabAdvancePct: 1, maxArvLtvPct: 0.75 });
    expect(resolvePurchaseTierRule(policy().calculator, "unknown")).toBeUndefined();
  });
});
