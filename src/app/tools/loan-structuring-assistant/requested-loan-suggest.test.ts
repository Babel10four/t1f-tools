import { describe, expect, it } from "vitest";
import type { LoanAssistantFields } from "./build-deal-analyze-request";
import { purchaseRequestedLoanSuggestedString, type PurchaseSuggestionPolicy } from "./requested-loan-suggest";

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
});
