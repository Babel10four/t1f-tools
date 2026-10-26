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
  collateralPropertyAddress: "",
  closingDate: "",
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
    expect(r.request.programContext).toBeUndefined();
  });

  const seasonedFields: typeof base = {
    ...base,
    payoffAmount: "700000",
    rehabBudget: "200000",
    requestedLoanAmount: "900000",
    asIsValue: "1000000",
    arv: "1400000",
    experienceTier: "1",
    refinanceScenario: "refinance_seasoned",
  };

  it.each(["0", "1", "T0", "T1", " Tier 0 ", "Tier 1"])(
    "serializes an explicitly selected seasoned refinance for %s",
    (experienceTier) => {
      const result = buildDealAnalyzeRequest("refinance", { ...seasonedFields, experienceTier });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.request.programContext).toEqual({ scenario: "refinance_seasoned" });
      expect(result.request.deal).toMatchObject({
        payoffAmount: 700_000,
        rehabBudget: 200_000,
        requestedLoanAmount: 900_000,
      });
    },
  );

  it.each([
    { rehabBudget: "" },
    { rehabBudget: "0" },
    { borrowingRehabFunds: "no" as const },
    { arv: "" },
    { arv: "0" },
    { arv: "invalid" },
    { experienceTier: "" },
    { experienceTier: "2" },
    { experienceTier: "3" },
  ])("blocks incomplete or unsupported seasoned inputs without generic fallback: %j", (fields) => {
    const result = buildDealAnalyzeRequest("refinance", { ...seasonedFields, ...fields });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.clientHint).toContain("No fallback calculation has been run");
    expect(result.clientHint).toContain("Tier 0 or Tier 1");
  });

  it("never infers seasoned refinance from otherwise eligible numbers", () => {
    const result = buildDealAnalyzeRequest("refinance", { ...seasonedFields, refinanceScenario: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.programContext).toBeUndefined();
  });

  it("does not leak a stale refinance scenario into a purchase request", () => {
    const result = buildDealAnalyzeRequest("purchase", {
      ...seasonedFields,
      purchasePrice: "1000000",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.deal.purpose).toBe("purchase");
    expect(result.request.programContext).toBeUndefined();
  });

  it("includes collateralPropertyAddress in assumptions when provided", () => {
    const r = buildDealAnalyzeRequest("purchase", {
      ...base,
      purchasePrice: "100000",
      collateralPropertyAddress: "  10 Oak St, Austin TX 78701  ",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.request.assumptions?.collateralPropertyAddress).toBe(
      "10 Oak St, Austin TX 78701",
    );
  });

  it("fails refinance when neither payoff nor requested amount", () => {
    const r = buildDealAnalyzeRequest("refinance", {
      ...base,
      asIsValue: "400000",
    });
    expect(r.ok).toBe(false);
  });
});
