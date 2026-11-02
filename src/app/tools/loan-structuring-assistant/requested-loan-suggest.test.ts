import { describe, expect, it } from "vitest";
import type { LoanAssistantFields } from "./build-deal-analyze-request";
import { purchaseRequestedLoanSuggestedString, purchaseRequestedLoanSuggestionDescription, type PurchaseSuggestionPolicy } from "./requested-loan-suggest";

const policy: PurchaseSuggestionPolicy = {
  purchaseTierRules: { "3": { initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 } },
};
const fields: LoanAssistantFields = {
  purchasePrice: "517500", rehabBudget: "27500", arv: "680000", experienceTier: "3",
  requestedLoanAmount: "", termMonths: "12", fico: "", payoffAmount: "", asIsValue: "",
  borrowingRehabFunds: "yes", originationPointsPercent: "0.6", originationFlatFee: "1195",
  noteRatePercent: "9.5", collateralPropertyAddress: "", closingDate: "2026-10-30",
};

describe("purchaseRequestedLoanSuggestedString", () => {
  it("suggests the policy maximum for Kayla's Tier 3 purchase", () => {
    expect(purchaseRequestedLoanSuggestedString(fields, policy)).toBe("467375");
  });
  it("applies the ARV cap when it is the binding limit", () => {
    expect(purchaseRequestedLoanSuggestedString({ ...fields, arv: "600000" }, policy)).toBe("450000");
  });
  it("excludes rehab when not taking rehab funds", () => {
    expect(purchaseRequestedLoanSuggestedString({ ...fields, borrowingRehabFunds: "no" }, policy)).toBe("439875");
  });
  it("does not substitute a Tier 1/2 suggestion for missing Tier 3 configuration", () => {
    expect(purchaseRequestedLoanSuggestedString(fields)).toBeNull();
    expect(purchaseRequestedLoanSuggestedString({ ...fields, experienceTier: "" }, policy)).toBeNull();
  });
  it("preserves established Tier 1/2 advance rates", () => {
    expect(purchaseRequestedLoanSuggestedString({ ...fields, experienceTier: "1" })).toBe("493250");
    expect(purchaseRequestedLoanSuggestedString({ ...fields, experienceTier: "2" })).toBe("493250");
  });
  it("keeps cents instead of rounding a fractional-dollar cap upward", () => {
    expect(purchaseRequestedLoanSuggestedString({ ...fields, purchasePrice: "517500.20" }, policy)).toBe("467375.17");
  });
  it.each([0, 0.75])("never suggests partial rehab from a configured rehab fraction of %s", (rehabAdvancePct) => {
    const invalidPolicy = { purchaseTierRules: { "3": { ...policy.purchaseTierRules!["3"], rehabAdvancePct } } };
    expect(purchaseRequestedLoanSuggestedString(fields, invalidPolicy)).toBeNull();
    expect(purchaseRequestedLoanSuggestionDescription(fields, invalidPolicy)).toContain("Rehab funding must be 0% or 100%");
  });
  it("withholds an automatic total below the full rehab budget", () => {
    const infeasible = { ...fields, arv: "10000" };
    expect(purchaseRequestedLoanSuggestedString(infeasible, policy)).toBeNull();
    expect(purchaseRequestedLoanSuggestionDescription(infeasible, policy)).toContain("ARV cap cannot cover the full rehab budget");
  });
  it("sizes the verified Tier 4 deal and keeps the ARV-constrained total consistent", () => {
    const regalwood = { ...fields, experienceTier: "4", purchasePrice: "160000", rehabBudget: "60000", arv: "275000" };
    expect(purchaseRequestedLoanSuggestedString(regalwood)).toBe("180000");
    expect(purchaseRequestedLoanSuggestedString({ ...regalwood, arv: "240000" })).toBe("168000");
    expect(purchaseRequestedLoanSuggestedString({ ...regalwood, borrowingRehabFunds: "no" })).toBe("120000");
  });
});
