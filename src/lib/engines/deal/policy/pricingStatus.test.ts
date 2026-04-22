import { describe, expect, it } from "vitest";
import { pricingStatusForSupportedDeal } from "./pricingStatus";

describe("pricingStatusForSupportedDeal", () => {
  it("returns insufficient_inputs when policy max is not defined", () => {
    expect(
      pricingStatusForSupportedDeal({
        policyMaxDefined: false,
        borrowerFicoDefined: true,
      }),
    ).toBe("insufficient_inputs");
  });

  it("returns complete when policy max is defined and borrower FICO is present", () => {
    expect(
      pricingStatusForSupportedDeal({
        policyMaxDefined: true,
        borrowerFicoDefined: true,
      }),
    ).toBe("complete");
  });

  it("returns indicative when policy max is defined but borrower FICO is missing", () => {
    expect(
      pricingStatusForSupportedDeal({
        policyMaxDefined: true,
        borrowerFicoDefined: false,
      }),
    ).toBe("indicative");
  });
});
