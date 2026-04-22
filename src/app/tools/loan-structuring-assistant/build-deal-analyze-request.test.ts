import { describe, expect, it } from "vitest";
import { buildDealAnalyzeRequest } from "./build-deal-analyze-request";

const base: Parameters<typeof buildDealAnalyzeRequest>[1] = {
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  requestedLoanAmount: "",
  termMonths: "",
  fico: "",
  experienceTier: "",
  payoffAmount: "",
  asIsValue: "",
  borrowingRehabFunds: "yes",
  originationPointsPercent: "",
  originationFlatFee: "",
  noteRatePercent: "",
};

describe("buildDealAnalyzeRequest", () => {
  it("serializes purchase with bridge_purchase and rehabBudget 0 when omitted", () => {
    const r = buildDealAnalyzeRequest("purchase", {
      ...base,
      purchasePrice: "350000",
      arv: "400000",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.request.schemaVersion).toBe("deal_analyze.v1");
    expect(r.request.deal.purpose).toBe("purchase");
    expect(r.request.deal.productType).toBe("bridge_purchase");
    expect(r.request.deal.rehabBudget).toBe(0);
    expect(r.request.deal.purchasePrice).toBe(350_000);
    expect(r.request.property?.arv).toBe(400_000);
    expect(r.request.assumptions?.borrowingRehabFunds).toBe(true);
  });

  it("serializes refinance with bridge_refinance", () => {
    const r = buildDealAnalyzeRequest("refinance", {
      ...base,
      payoffAmount: "300000",
      asIsValue: "500000",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.request.deal.purpose).toBe("refinance");
    expect(r.request.deal.productType).toBe("bridge_refinance");
    expect(r.request.deal.payoffAmount).toBe(300_000);
    expect(r.request.property?.asIsValue).toBe(500_000);
    expect(r.request.deal.rehabBudget).toBe(0);
  });

  it("fails refinance when neither payoff nor requested amount", () => {
    const r = buildDealAnalyzeRequest("refinance", {
      ...base,
      asIsValue: "400000",
    });
    expect(r.ok).toBe(false);
  });
});
