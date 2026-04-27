import { describe, expect, it } from "vitest";
import type { DealAnalyzePricingOutV1 } from "@/lib/engines/deal/schemas/canonical-response";
import { allPricingScalarsNull, formatPricingScalar } from "./pricing-display";

describe("pricing-display", () => {
  it("detects all-null scalars", () => {
    const p: DealAnalyzePricingOutV1 = {
      status: "complete",
      noteRatePercent: null,
      marginBps: null,
      discountPoints: null,
      lockDays: null,
    };
    expect(allPricingScalarsNull(p)).toBe(true);
  });

  it("formats scalars without inventing policy", () => {
    const p: DealAnalyzePricingOutV1 = {
      status: "complete",
      noteRatePercent: 7.25,
      marginBps: 150,
      discountPoints: 1,
      lockDays: 30,
    };
    expect(formatPricingScalar("noteRatePercent", p)).toBe("7.25%");
    expect(formatPricingScalar("marginBps", p)).toBe("150 bps");
  });

  it("formats note rate without rounding away fractional precision", () => {
    const p: DealAnalyzePricingOutV1 = {
      status: "complete",
      noteRatePercent: 9.125,
      marginBps: null,
      discountPoints: null,
      lockDays: null,
    };
    expect(formatPricingScalar("noteRatePercent", p)).toBe("9.125%");
  });
});
