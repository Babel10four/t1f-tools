import { describe, expect, it } from "vitest";
import type { DealAnalyzeRequestV1 } from "../schemas/canonical-request";
import {
  purchaseBindingFlags,
  purchasePolicyBreakdown,
  purchasePolicyMax,
} from "./purchaseMax";
import {
  POLICY_MAX_ARV_LTV_PCT,
  POLICY_MAX_LTC_PCT,
  TIER12_MAX_ARV_LTV_PCT,
} from "./constants";

function req(partial: DealAnalyzeRequestV1): DealAnalyzeRequestV1 {
  return partial;
}

describe("purchasePolicyBreakdown / purchasePolicyMax (TICKET-002A)", () => {
  it("computes ltcCap equal to cost-basis cap and omits arvCap when arv is missing", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 350_000,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { asIsValue: 400_000 },
      }),
    );
    expect(b).toBeDefined();
    expect(b!.basis).toBe(350_000);
    expect(b!.costBasisCap).toBe(262_500);
    expect(b!.ltcCap).toBe(b!.costBasisCap);
    expect(b!.arvCap).toBeUndefined();
    expect(b!.policyMax).toBe(262_500);
    expect(
      purchasePolicyMax(
        req({
          schemaVersion: "deal_analyze.v1",
          deal: {
            purpose: "purchase",
            productType: "bridge_purchase",
            purchasePrice: 350_000,
            rehabBudget: 0,
            termMonths: null,
          },
          property: { asIsValue: 400_000 },
        }),
      ),
    ).toBe(262_500);
  });

  it("returns undefined when cost basis is not positive (no LTC / policy leg)", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 50_000,
          rehabBudget: -50_000,
          termMonths: null,
        },
        property: { arv: 200_000 },
      }),
    );
    expect(b).toBeUndefined();
  });

  it("when both legs apply, policyMax is min of caps", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 100_000,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { arv: 200_000 },
      }),
    );
    expect(b!.costBasisCap).toBe(75_000);
    expect(b!.arvCap).toBe(140_000);
    expect(b!.policyMax).toBe(75_000);
  });

  it("tier 1/2: 90% purchase + 100% rehab vs 75% ARV", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 75_000,
          rehabBudget: 75_000,
          termMonths: null,
        },
        property: { arv: 210_000 },
        borrower: { experienceTier: "1" },
      }),
    );
    expect(b!.tier12AdvanceRule).toBe(true);
    const sumAdvance = 0.9 * 75_000 + 75_000;
    expect(b!.costBasisCap).toBe(sumAdvance);
    expect(b!.arvCap).toBe(TIER12_MAX_ARV_LTV_PCT * 210_000);
    expect(b!.policyMax).toBe(Math.min(sumAdvance, TIER12_MAX_ARV_LTV_PCT * 210_000));
  });
});

describe("purchaseBindingFlags (TICKET-002A)", () => {
  it("emits PURCHASE_POLICY_MAX_BINDS_LTC when LTC leg is strictly tighter", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 100_000,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { arv: 200_000 },
      }),
    )!;
    const codes = purchaseBindingFlags(b).map((f) => f.code);
    expect(codes).toEqual(["PURCHASE_POLICY_MAX_BINDS_LTC"]);
  });

  it("emits PURCHASE_POLICY_MAX_BINDS_ARV when ARV leg is strictly tighter", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 1_000_000,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { arv: 800_000 },
      }),
    )!;
    expect(b.policyMax).toBe(Math.min(
      POLICY_MAX_LTC_PCT * 1_000_000,
      POLICY_MAX_ARV_LTV_PCT * 800_000,
    ));
    const codes = purchaseBindingFlags(b).map((f) => f.code);
    expect(codes).toEqual(["PURCHASE_POLICY_MAX_BINDS_ARV"]);
  });

  it("emits both bind flags when cost and ARV caps tie within $0.01", () => {
    const basis = 1_000_000;
    const arv = 750_000 / POLICY_MAX_ARV_LTV_PCT;
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: basis,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { arv },
      }),
    )!;
    expect(Math.abs(b.costBasisCap - b.arvCap!)).toBeLessThanOrEqual(0.01);
    const codes = purchaseBindingFlags(b).map((f) => f.code).sort();
    expect(codes).toEqual([
      "PURCHASE_POLICY_MAX_BINDS_ARV",
      "PURCHASE_POLICY_MAX_BINDS_LTC",
    ]);
  });

  it("returns no binding flags when only the cost-basis leg exists", () => {
    const b = purchasePolicyBreakdown(
      req({
        schemaVersion: "deal_analyze.v1",
        deal: {
          purpose: "purchase",
          productType: "bridge_purchase",
          purchasePrice: 350_000,
          rehabBudget: 0,
          termMonths: null,
        },
        property: { asIsValue: 400_000 },
      }),
    )!;
    expect(purchaseBindingFlags(b)).toEqual([]);
  });
});
