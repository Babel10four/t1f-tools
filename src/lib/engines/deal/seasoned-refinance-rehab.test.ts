import { describe, expect, it } from "vitest";
import { handleDealAnalyzePost } from "../http";
import { runDealAnalyze } from "./analyze";
import { getFallbackPolicySnapshot } from "./policy/policy-snapshot";
import { refinancePolicyMax } from "./policy/refinanceMax";
import type { DealAnalyzeRequestV1 } from "./schemas/canonical-request";

function request(): DealAnalyzeRequestV1 {
  return {
    schemaVersion: "deal_analyze.v1",
    deal: {
      purpose: "refinance", productType: "bridge_refinance",
      payoffAmount: 700_000, requestedLoanAmount: 900_000,
      rehabBudget: 200_000, termMonths: 12,
    },
    property: { asIsValue: 1_000_000, arv: 1_400_000 },
    borrower: { experienceTier: "1" },
    programContext: { scenario: "refinance_seasoned" },
    assumptions: { borrowingRehabFunds: true, noteRatePercent: 10, originationPointsPercent: 0.5 },
  };
}

describe("verified T0/T1 seasoned refinance with rehab", () => {
  it.each([undefined, null, "false", "true", 0, 1, false, true])("enforces explicit rehab confirmation through HTTP normalization for %s", async (funding) => {
    const req = request();
    req.assumptions!.borrowingRehabFunds = funding;
    const response = await handleDealAnalyzePost(new Request("http://localhost/api/deal/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req),
    }));
    expect(response.status).toBe(200);
    const out = await response.json();
    if (funding === true) {
      expect(out.loan.amount).toBe(900_000);
    } else {
      expect(out.loan.amount).toBeUndefined();
      expect(out.pricing.status).toBe("needs_review");
      expect(out.risks.some((r: { code: string }) => r.code === "SEASONED_REFINANCE_POLICY_UNAVAILABLE")).toBe(true);
    }
  });

  it("funds the requested payoff and full rehab under the 70% ARV total cap", async () => {
    const req = request();
    expect(refinancePolicyMax(req)).toEqual({ policyMax: 980_000, basis: 1_400_000, basisSource: "arv" });
    const out = await runDealAnalyze(req);
    expect(out.loan).toMatchObject({
      amount: 900_000, acquisitionLoanAmount: 700_000, rehabLoanAmount: 200_000,
      ltv: 64.29, arvLtv: 64.29, bindingLeg: "arv_ltv_refi", governingLeverageMetric: "arv_ltv",
    });
    expect(out.cashToClose.items[0].amount).toBe(0);
    expect(out.cashToClose.items[1].amount).toBe(4_500);
    expect(out.pricing.noteRatePercent).toBe(10);
    expect(out.analysis.status).toBe("incomplete"); // FICO was not supplied.
    expect(out.risks.some((r) => r.code === "MISSING_BORROWER_PRICING_INPUT")).toBe(true);
    expect(out.risks.some((r) => r.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(false);
  });

  it.each(["0", "1", "T0", "T1", "Tier 0", " tier 1 "])("accepts the verified tier spelling %s", async (tier) => {
    const req = request();
    req.borrower!.experienceTier = tier;
    expect((await runDealAnalyze(req)).loan.amount).toBe(900_000);
  });

  it("ignores the generic refinance scalar and as-is value for this explicit branch", async () => {
    const req = request();
    req.property!.asIsValue = 10_000_000;
    req.deal.requestedLoanAmount = 1_000_000;
    const fallback = getFallbackPolicySnapshot();
    const out = await runDealAnalyze(req, { policySnapshot: {
      ...fallback, source: "published",
      calculator: { ...fallback.calculator, refinanceMaxLtvPct: 0.99 },
    } });
    expect(out.loan).toMatchObject({ amount: 980_000, acquisitionLoanAmount: 780_000, rehabLoanAmount: 200_000, ltv: 70 });
    expect(out.risks.some((r) => r.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(true);
  });

  it("uses the ARV cap when no amount is requested", async () => {
    const req = request();
    delete req.deal.requestedLoanAmount;
    expect((await runDealAnalyze(req)).loan.amount).toBe(980_000);
  });

  it("uses ARV deliberately, not as an assumed fallback when as-is is missing", async () => {
    const req = request();
    delete req.property!.asIsValue;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBe(900_000);
    expect(out.risks.some((r) => r.code === "VALUE_BASIS_ASSUMED")).toBe(false);
  });

  it.each([undefined, 0])("withholds amounts for ARV %s even when as-is is positive", async (arv) => {
    const req = request();
    req.property!.arv = arv;
    req.borrower!.fico = 780;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.acquisitionLoanAmount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose).toEqual({ status: "insufficient_inputs", estimatedTotal: null, items: [] });
    expect(out.analysis.status).toBe("incomplete");
    expect(out.pricing.status).toBe("needs_review");
    expect(out.risks.find((r) => r.code === "MISSING_COLLATERAL_VALUE")?.detail).toContain("as-is value cannot substitute");
  });

  it.each([undefined, "", "2", "3", "4", "unknown"])("withholds amounts for missing/unsupported tier %s", async (tier) => {
    const req = request();
    req.borrower = { fico: 780, experienceTier: tier };
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.status).toBe("incomplete");
    expect(out.pricing.status).toBe("needs_review");
    expect(out.risks.some((r) => r.code === "SEASONED_REFINANCE_POLICY_UNAVAILABLE")).toBe(true);
  });

  it.each([0, 199_999.99])("withholds request %s instead of truncating the rehab holdback", async (ask) => {
    const req = request();
    req.deal.requestedLoanAmount = ask;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.loan.rehabLoanAmount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.status).toBe("incomplete");
    expect(out.pricing.status).toBe("needs_review");
    expect(out.risks.some((r) => r.code === "REFINANCE_REHAB_HOLDBACK_SHORTFALL")).toBe(true);
  });

  it("withholds an ARV-capped total below the full rehab holdback", async () => {
    const req = request();
    req.property!.arv = 200_000;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.analysis.flags.find((f) => f.code === "REFINANCE_REHAB_HOLDBACK_SHORTFALL")?.context)
      .toEqual({ availableLoanAmount: 140_000, requiredRehabHoldback: 200_000 });
  });

  it("honors a lower request without reducing the full rehab holdback", async () => {
    const req = request();
    req.deal.requestedLoanAmount = 800_000;
    const out = await runDealAnalyze(req);
    expect(out.loan).toMatchObject({ amount: 800_000, acquisitionLoanAmount: 600_000, rehabLoanAmount: 200_000 });
    expect(out.cashToClose.items[0].amount).toBe(100_000);
  });

  it.each([undefined, null, "false", "true", 0, 1, false])("withholds the explicit scenario for unconfirmed/invalid rehab funding %s", async (funding) => {
    const req = request();
    req.assumptions!.borrowingRehabFunds = funding;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.pricing.status).toBe("needs_review");
    expect(out.risks.some((r) => r.code === "SEASONED_REFINANCE_POLICY_UNAVAILABLE")).toBe(true);
  });

  it("withholds the explicit scenario when the entire assumptions bag is absent", async () => {
    const req = request();
    delete req.assumptions;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.pricing.status).toBe("needs_review");
  });

  it("preserves cents in the cap and full holdback allocation", async () => {
    const req = request();
    req.property!.arv = 1_000_000.01;
    req.deal.rehabBudget = 200_000.02;
    expect((await runDealAnalyze(req)).loan).toMatchObject({ amount: 700_000.01, acquisitionLoanAmount: 499_999.99, rehabLoanAmount: 200_000.02 });
  });

  it.each([undefined, "refinance_platform", "refinance_75pct_aiv_completed"] as const)("preserves legacy refinance sizing for scenario %s", async (scenario) => {
    const req = request();
    req.programContext = scenario ? { scenario } : undefined;
    expect((await runDealAnalyze(req)).loan).toMatchObject({ amount: 750_000, acquisitionLoanAmount: 550_000, rehabLoanAmount: 200_000 });
  });

  it("withholds the explicit scenario without rehab instead of falling back to as-is", async () => {
    const req = request();
    req.deal.rehabBudget = 0;
    const out = await runDealAnalyze(req);
    expect(out.loan.amount).toBeUndefined();
    expect(out.cashToClose.estimatedTotal).toBeNull();
    expect(out.analysis.status).toBe("incomplete");
    expect(out.risks.some((r) => r.code === "SEASONED_REFINANCE_POLICY_UNAVAILABLE")).toBe(true);
  });

  it("preserves generic no-rehab and declined-rehab behavior without an explicit scenario", async () => {
    const req = request();
    delete req.programContext;
    req.assumptions!.borrowingRehabFunds = false;
    expect((await runDealAnalyze(req)).loan).toMatchObject({ amount: 750_000, acquisitionLoanAmount: 750_000, rehabLoanAmount: 0 });
    req.deal.rehabBudget = 0;
    expect((await runDealAnalyze(req)).loan).toMatchObject({ amount: 750_000, acquisitionLoanAmount: 750_000, rehabLoanAmount: 0 });
  });
});
