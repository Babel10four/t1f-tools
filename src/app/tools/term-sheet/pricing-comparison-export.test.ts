import { describe, expect, it } from "vitest";
import {
  computePricingComparison,
  type PricingComparisonInputs,
} from "@/lib/tools/pricing-comparison";
import {
  buildPricingComparisonEmailHtml,
  buildPricingComparisonPlainText,
  type PricingComparisonExportInput,
} from "./pricing-comparison-export";

const INPUTS: PricingComparisonInputs = {
  purchasePrice: 300_000,
  initialLoanAmount: 0,
  holdbackAmount: 50_000,
  avgHoldbackDisbursedFraction: 0.5,
  loanDurationMonths: 8,
  t1f: {
    structure: "non_dutch",
    leveragePercentOfPurchase: 90,
    ratePercent: 8.5,
    originationPointsPercent: 0.5,
    adminFees: 1_195,
  },
  competitor: {
    structure: "dutch",
    leveragePercentOfPurchase: 100,
    ratePercent: 9.5,
    originationPointsPercent: 2,
    adminFees: 2_000,
  },
};

function makeInput(): PricingComparisonExportInput {
  return {
    result: computePricingComparison(INPUTS),
    loanDurationMonths: INPUTS.loanDurationMonths,
    t1fRatePercent: INPUTS.t1f.ratePercent,
    competitorRatePercent: INPUTS.competitor.ratePercent,
  };
}

describe("buildPricingComparisonPlainText", () => {
  it("includes purchase price, both sides, and savings", () => {
    const text = buildPricingComparisonPlainText(makeInput());
    expect(text).toContain("Pricing Comparison");
    expect(text).toContain("Purchase price: $300,000");
    expect(text).toContain("TIER ONE FUNDING");
    expect(text).toContain("COMPETITOR");
    // Total loan amounts (T1F 320k, competitor 350k).
    expect(text).toContain("$320,000");
    expect(text).toContain("$350,000");
    // Savings: competitor total 32,750 - T1F total 19,512 = 13,238.
    expect(text).toContain("Total savings with Tier One Funding: $13,238");
  });

  it("excludes internal-only figures", () => {
    const text = buildPricingComparisonPlainText(makeInput());
    expect(text).not.toMatch(/revenue/i);
    expect(text).not.toMatch(/adjusted/i);
  });

  it("shows per-side rate and structure for borrower context", () => {
    const text = buildPricingComparisonPlainText(makeInput());
    expect(text).toContain("Rate: 8.5%");
    expect(text).toContain("Rate: 9.5%");
    expect(text).toContain("Draw (interest on funds drawn)");
    expect(text).toContain("Term (interest on full balance)");
  });
});

describe("buildPricingComparisonEmailHtml", () => {
  it("renders a table with the savings value and excludes internal figures", () => {
    const html = buildPricingComparisonEmailHtml(makeInput());
    expect(html).toContain("<table");
    expect(html).toContain("Tier One Funding");
    expect(html).toContain("Competitor");
    expect(html).toContain("$13,238");
    expect(html).not.toMatch(/revenue/i);
    expect(html).not.toMatch(/adjusted/i);
  });
});
