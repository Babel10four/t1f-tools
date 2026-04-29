import { describe, expect, it } from "vitest";
import { handleDealAnalyzePost } from "@/lib/engines/http";

async function postJson(body: unknown) {
  const r = new Request("http://localhost/api/deal/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return handleDealAnalyzePost(r);
}

type ErrorBody = {
  error: string;
  code: string;
  issues: unknown[];
};

async function expect400(
  res: Response,
  code: string,
): Promise<ErrorBody> {
  expect(res.status).toBe(400);
  const json = (await res.json()) as ErrorBody;
  expect(json.code).toBe(code);
  expect(Array.isArray(json.issues)).toBe(true);
  expect("error" in json && typeof json.error === "string").toBe(true);
  return json;
}

describe("POST /api/deal/analyze (TICKET-001 / 001A)", () => {
  it("returns 200 for valid minimal purchase with asIsValue", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 350_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.schemaVersion).toBe("deal_analyze.v1");
    expect(json.analysis).toBeDefined();
    const analysis = json.analysis as { status: string; flags: unknown[] };
    expect(["complete", "incomplete"]).toContain(analysis.status);
    expect(Array.isArray(analysis.flags)).toBe(true);
    expect("reasonCodes" in analysis).toBe(false);
    const pricing = json.pricing as { status: string };
    const ctc = json.cashToClose as { status: string };
    expect(pricing.status).not.toBe("stub");
    expect(ctc.status).not.toBe("stub");
    expect(Array.isArray(json.risks)).toBe(true);
    const loan = json.loan as Record<string, unknown>;
    expect("ltvPercent" in loan).toBe(false);
    expect(loan.amount).toBe(262_500);
    const unsupported = analysis.flags.some(
      (f) => (f as { code?: string }).code === "UNSUPPORTED_PRODUCT_V1",
    );
    expect(unsupported).toBe(false);
  });

  it("returns 200 for valid refinance with loan.ltv (not ltvPercent)", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        payoffAmount: 450_000,
        termMonths: null,
      },
      property: { asIsValue: 600_000 },
      borrower: { fico: 700 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    const loan = json.loan as { ltv?: number; ltvPercent?: number; purpose: string };
    expect(loan.purpose).toBe("refinance");
    expect(loan.ltv).toBeDefined();
    expect(loan.ltv).toBe(75);
    expect(loan.ltvPercent).toBeUndefined();
  });

  it("returns 200 for unsupported product with UNSUPPORTED_PRODUCT_V1 and no loan.amount", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "Fix & Flip",
        purchasePrice: 350_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      loan: Record<string, unknown>;
      analysis: { flags: { code: string }[] };
      risks: { code: string }[];
      pricing: { status: string };
    };
    expect(json.loan.amount).toBeUndefined();
    expect(json.pricing.status).toBe("stub");
    expect(json.risks.some((r) => r.code === "UNSUPPORTED_PRODUCT_V1")).toBe(true);
    expect(
      json.analysis.flags.some((f) => f.code === "UNSUPPORTED_PRODUCT_V1"),
    ).toBe(true);
  });

  it("returns 400 UNKNOWN_REQUEST_FIELD for unsupported top-level field", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      unknownTopLevel: true,
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 350_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
    });
    await expect400(res, "UNKNOWN_REQUEST_FIELD");
  });

  it("returns 400 UNKNOWN_REQUEST_FIELD for unknown deal field", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 350_000,
        termMonths: null,
        legacyExtra: 1,
      },
      property: { asIsValue: 400_000 },
    });
    await expect400(res, "UNKNOWN_REQUEST_FIELD");
  });

  it("returns 400 UNSUPPORTED_SCHEMA_VERSION when schemaVersion is missing", async () => {
    const res = await postJson({
      deal: {
        purpose: "purchase",
        productType: "X",
        purchasePrice: 1,
        termMonths: null,
      },
      property: { arv: 2 },
    });
    await expect400(res, "UNSUPPORTED_SCHEMA_VERSION");
  });

  it("returns 400 UNSUPPORTED_SCHEMA_VERSION when schemaVersion is null", async () => {
    const res = await postJson({
      schemaVersion: null,
      deal: {
        purpose: "purchase",
        productType: "X",
        purchasePrice: 1,
        termMonths: null,
      },
      property: { arv: 2 },
    });
    const json = await expect400(res, "UNSUPPORTED_SCHEMA_VERSION");
    expect(json.issues.length).toBeGreaterThanOrEqual(0);
  });

  it("returns 400 UNSUPPORTED_SCHEMA_VERSION when schemaVersion is not a string", async () => {
    const res = await postJson({
      schemaVersion: 1,
      deal: {
        purpose: "purchase",
        productType: "X",
        purchasePrice: 1,
        termMonths: null,
      },
      property: { arv: 2 },
    });
    await expect400(res, "UNSUPPORTED_SCHEMA_VERSION");
  });

  it("returns 400 UNSUPPORTED_SCHEMA_VERSION for wrong schema string", async () => {
    const res = await postJson({
      schemaVersion: "1",
      deal: {
        purpose: "purchase",
        productType: "X",
        purchasePrice: 1,
        termMonths: null,
      },
      property: { arv: 2 },
    });
    await expect400(res, "UNSUPPORTED_SCHEMA_VERSION");
  });

  it("returns 400 MISSING_PURCHASE_PRICE for canonical numeric string purchasePrice", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: "500000",
        termMonths: null,
      },
      property: { arv: 200_000 },
    });
    await expect400(res, "MISSING_PURCHASE_PRICE");
  });

  it("returns 400 AMBIGUOUS_INPUT_SHAPE when both deal and loan objects are present", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      loan: { purpose: "purchase", productType: "X" },
      property: { arv: 120_000 },
    });
    await expect400(res, "AMBIGUOUS_INPUT_SHAPE");
  });

  it("returns 400 UNSUPPORTED_SCHEMA_VERSION for wrong schema (v0)", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v0",
      deal: {
        purpose: "purchase",
        productType: "X",
        purchasePrice: 1,
        termMonths: null,
      },
      property: { arv: 2 },
    });
    await expect400(res, "UNSUPPORTED_SCHEMA_VERSION");
  });

  it("returns 400 MISSING_DEAL when deal is absent", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      property: { arv: 100_000 },
    });
    await expect400(res, "MISSING_DEAL");
  });

  it("returns 400 MISSING_PURPOSE", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { arv: 200_000 },
    });
    await expect400(res, "MISSING_PURPOSE");
  });

  it("returns 400 MISSING_PRODUCT_TYPE", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "   ",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { arv: 200_000 },
    });
    await expect400(res, "MISSING_PRODUCT_TYPE");
  });

  it("returns 400 MISSING_PURCHASE_PRICE for purchase", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        termMonths: null,
      },
      property: { arv: 200_000 },
    });
    await expect400(res, "MISSING_PURCHASE_PRICE");
  });

  it("returns 400 MISSING_REFI_AMOUNT for refinance", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        termMonths: null,
      },
      property: { arv: 200_000 },
    });
    await expect400(res, "MISSING_REFI_AMOUNT");
  });

  it("returns 400 MISSING_COLLATERAL_VALUE", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
    });
    await expect400(res, "MISSING_COLLATERAL_VALUE");
  });

  it("treats omitted rehabBudget as 0", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { asIsValue: 150_000 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { loan: { rehabBudget: number } };
    expect(json.loan.rehabBudget).toBe(0);
  });

  it("coerces legacy numeric strings only from loan subtree", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      loan: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: "325000",
        property: { asIsValue: "410000" },
      },
    });
    expect(res.status).toBe(200);
  });

  it("maps legacy loan subtree including nested property strings", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      loan: {
        purpose: "refinance",
        productType: "bridge_refinance",
        payoffAmount: "400000",
        termMonths: "360",
        property: { arv: "550000" },
      },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      loan: { payoffAmount: number; ltv?: number; ltvPercent?: number };
    };
    expect(json.loan.payoffAmount).toBe(400_000);
    expect(json.loan.ltv).toBeDefined();
    expect(json.loan.ltvPercent).toBeUndefined();
  });

  it("surfaces IGNORED_REQUEST_OUTPUT_FIELDS for request pricing / cashToClose", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 200_000,
        termMonths: null,
      },
      property: { asIsValue: 220_000 },
      pricing: { noteRatePercent: 7 },
      cashToClose: { estimatedTotal: 1 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
    };
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes.filter((c) => c === "IGNORED_REQUEST_OUTPUT_FIELDS").length).toBe(2);
  });

  it("returns 400 INVALID_JSON for invalid JSON with issues array", async () => {
    const res = await postJson("{not json");
    const json = await expect400(res, "INVALID_JSON");
    expect(json.issues).toEqual([]);
  });

  it("returns REQUEST_EXCEEDS_POLICY_MAX when requestedLoanAmount is above policy max", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        requestedLoanAmount: 1_000_000,
        termMonths: null,
      },
      property: { arv: 500_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      loan: { amount: number };
      risks: { code: string }[];
    };
    expect(json.loan.amount).toBe(75_000);
    expect(json.risks.some((r) => r.code === "REQUEST_EXCEEDS_POLICY_MAX")).toBe(
      true,
    );
  });

  it("uses policy max as loan.amount when requestedLoanAmount is absent", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { arv: 200_000 },
      borrower: { fico: 700 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { loan: { amount: number } };
    expect(json.loan.amount).toBe(75_000);
  });

  it("pricing.status is complete when borrower FICO present and policy max exists", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        payoffAmount: 300_000,
        termMonths: null,
      },
      property: { asIsValue: 500_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      pricing: { status: string };
      cashToClose: { status: string };
    };
    expect(json.pricing.status).toBe("complete");
    expect(json.cashToClose.status).toBe("complete");
  });

  it("purchase without rehab stays pricing indicative when FICO is present (POLICY_MAPPING_PENDING)", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 350_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000, arv: 500_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      pricing: { status: string };
      cashToClose: { status: string };
      loan: { governingLeverageMetric?: string };
      analysis: { flags: { code: string }[] };
    };
    expect(json.pricing.status).toBe("indicative");
    expect(json.cashToClose.status).toBe("indicative");
    expect(json.loan.governingLeverageMetric).toBeUndefined();
    expect(
      json.analysis.flags.some((f) => f.code === "POLICY_MAPPING_PENDING"),
    ).toBe(true);
  });

  it("DOC-001: loan.ltv uses 0–100 percent scale (not 0–1 ratio)", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "refinance",
        productType: "bridge_refinance",
        payoffAmount: 300_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
      borrower: { fico: 700 },
    });
    const json = (await res.json()) as { loan: { ltv: number } };
    expect(json.loan.ltv).toBe(75);
    expect(json.loan.ltv).toBeGreaterThan(1);
  });

  it("response has no analysis.reasonCodes", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { arv: 120_000, asIsValue: 115_000 },
      borrower: { fico: 740 },
    });
    const json = (await res.json()) as { analysis: Record<string, unknown> };
    expect("reasonCodes" in json.analysis).toBe(false);
  });
});

describe("POST /api/deal/analyze (TICKET-002A LTC / binding flags)", () => {
  it("adds PURCHASE_POLICY_MAX_BINDS_LTC when LTC leg binds policy max", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 100_000,
        termMonths: null,
      },
      property: { arv: 200_000, asIsValue: 190_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
    };
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes).toContain("PURCHASE_POLICY_MAX_BINDS_LTC");
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_ARV");
  });

  it("adds PURCHASE_POLICY_MAX_BINDS_ARV when ARV leg binds policy max", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 1_000_000,
        termMonths: null,
      },
      property: { arv: 800_000, asIsValue: 780_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
    };
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes).toContain("PURCHASE_POLICY_MAX_BINDS_ARV");
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_LTC");
  });

  it("adds both bind flags when ARV and LTC caps tie within 1¢", async () => {
    const basis = 1_000_000;
    const arv = 750_000 / 0.7;
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: basis,
        termMonths: null,
      },
      property: { arv, asIsValue: arv * 0.99 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
    };
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes).toContain("PURCHASE_POLICY_MAX_BINDS_LTC");
    expect(codes).toContain("PURCHASE_POLICY_MAX_BINDS_ARV");
  });

  it("emits LTC_OVER_LIMIT when requestedLoanAmount strictly exceeds ltcCap", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 1_000_000,
        requestedLoanAmount: 800_000,
        termMonths: null,
      },
      property: { arv: 2_000_000, asIsValue: 1_900_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      risks: { code: string; title: string; detail: string }[];
    };
    const r = json.risks.find((x) => x.code === "LTC_OVER_LIMIT");
    expect(r).toBeDefined();
    expect(r!.title).toBe("Requested loan exceeds LTC limit");
    expect(r!.detail).toContain("Requested amount 800000 exceeds the LTC-based maximum 750000");
    expect(r!.detail).toContain("(0.75 of cost basis 1000000)");
    expect(r!.detail).toContain("The recommended amount is capped; confirm leverage with capital policy.");
  });

  it("does not emit LTC_OVER_LIMIT when requestedLoanAmount equals ltcCap", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 1_000_000,
        requestedLoanAmount: 750_000,
        termMonths: null,
      },
      property: { arv: 2_000_000, asIsValue: 1_900_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { risks: { code: string }[] };
    expect(json.risks.some((x) => x.code === "LTC_OVER_LIMIT")).toBe(false);
  });

  it("does not add binding flags when ARV leg is absent (single cost-basis leg)", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 350_000,
        termMonths: null,
      },
      property: { asIsValue: 400_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
    };
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_LTC");
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_ARV");
  });

  it("does not add top-level or loan.ltc fields on supported purchase", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "bridge_purchase",
        purchasePrice: 1_000_000,
        requestedLoanAmount: 700_000,
        termMonths: null,
      },
      property: { arv: 2_000_000, asIsValue: 1_900_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown> & {
      loan: Record<string, unknown>;
    };
    expect(Object.prototype.hasOwnProperty.call(json, "ltc")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(json.loan, "ltc")).toBe(false);
  });

  it("keeps unsupported purchase unchanged — no binding flags or LTC risk", async () => {
    const res = await postJson({
      schemaVersion: "deal_analyze.v1",
      deal: {
        purpose: "purchase",
        productType: "Fix & Flip",
        purchasePrice: 1_000_000,
        requestedLoanAmount: 900_000,
        termMonths: null,
      },
      property: { arv: 2_000_000, asIsValue: 1_900_000 },
      borrower: { fico: 720 },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      analysis: { flags: { code: string }[] };
      risks: { code: string }[];
      loan: Record<string, unknown>;
    };
    expect(json.loan.amount).toBeUndefined();
    const codes = json.analysis.flags.map((f) => f.code);
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_LTC");
    expect(codes).not.toContain("PURCHASE_POLICY_MAX_BINDS_ARV");
    expect(json.risks.some((r) => r.code === "LTC_OVER_LIMIT")).toBe(false);
  });
});
