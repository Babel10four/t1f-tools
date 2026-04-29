import { describe, expect, it } from "vitest";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import type { DealAnalyzeLoanOutV1 } from "../schemas/canonical-response";
import {
  enrichLoanWithLeveragePresentation,
  inferPurchaseBindingLeg,
  isPurchaseNoRehabPolicyMappingPending,
} from "./leveragePresentation";
import type { PurchasePolicyBreakdown } from "./purchaseMax";
import type { RefinancePolicyMaxResult } from "./refinanceMax";

function purchaseReq(overrides: Partial<DealAnalyzeRequestV1> = {}): DealAnalyzeRequestV1 {
  return {
    schemaVersion: "deal_analyze.v1",
    deal: {
      purpose: "purchase",
      productType: "bridge_purchase",
      purchasePrice: 100_000,
      rehabBudget: 50_000,
      termMonths: null,
    },
    property: { arv: 200_000, asIsValue: 110_000 },
    ...overrides,
  };
}

describe("leveragePresentation", () => {
  it("inferPurchaseBindingLeg returns arv_ltv when ARV cap binds", () => {
    const breakdown: PurchasePolicyBreakdown = {
      basis: 150_000,
      costBasisCap: 112_500,
      ltcCap: 112_500,
      arvCap: 100_000,
      policyMax: 100_000,
    };
    expect(inferPurchaseBindingLeg(breakdown)).toBe("arv_ltv");
  });

  it("inferPurchaseBindingLeg returns ltc when cost basis cap binds", () => {
    const breakdown: PurchasePolicyBreakdown = {
      basis: 150_000,
      costBasisCap: 112_500,
      ltcCap: 112_500,
      arvCap: 140_000,
      policyMax: 112_500,
    };
    expect(inferPurchaseBindingLeg(breakdown)).toBe("ltc");
  });

  it("isPurchaseNoRehabPolicyMappingPending is true only for purchase with zero rehab", () => {
    expect(
      isPurchaseNoRehabPolicyMappingPending(
        purchaseReq({ deal: { ...purchaseReq().deal, rehabBudget: 0 } }),
      ),
    ).toBe(true);
    expect(isPurchaseNoRehabPolicyMappingPending(purchaseReq())).toBe(false);
  });

  it("enrichLoanWithLeveragePresentation clears governing metric when no-rehab purchase mapping pending", () => {
    const req = purchaseReq({
      deal: { ...purchaseReq().deal, rehabBudget: 0 },
    });
    const breakdown: PurchasePolicyBreakdown = {
      basis: 100_000,
      costBasisCap: 75_000,
      ltcCap: 75_000,
      arvCap: 140_000,
      policyMax: 75_000,
    };
    const loan: DealAnalyzeLoanOutV1 = {
      purpose: "purchase",
      productType: "bridge_purchase",
      termMonths: null,
      rehabBudget: 0,
      purchasePrice: 100_000,
      amount: 75_000,
      ltcPercent: 75,
    };
    const refi: RefinancePolicyMaxResult = {
      policyMax: undefined,
      basis: undefined,
      basisSource: undefined,
    };
    const out = enrichLoanWithLeveragePresentation(loan, req, refi, breakdown);
    expect(out.governingLeverageMetric).toBeUndefined();
    expect(out.arvLtv).toBe(37.5);
    expect(out.bindingLeg).toBe("ltc");
  });

  it("refinance enrich uses aiv_ltv when as-is basis applies", () => {
    const req: DealAnalyzeRequestV1 = {
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        payoffAmount: 300_000,
        rehabBudget: 0,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
    };
    const refi: RefinancePolicyMaxResult = {
      policyMax: 300_000,
      basis: 400_000,
      basisSource: "as_is",
    };
    const loan: DealAnalyzeLoanOutV1 = {
      purpose: "refinance",
      productType: "bridge_refinance",
      termMonths: null,
      rehabBudget: 0,
      amount: 300_000,
      ltv: 75,
    };
    const out = enrichLoanWithLeveragePresentation(loan, req, refi, undefined);
    expect(out.governingLeverageMetric).toBe("aiv_ltv");
    expect(out.bindingLeg).toBe("aiv_ltv_refi");
    expect(out.aivLtv).toBe(75);
  });
});
