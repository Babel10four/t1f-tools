/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
  DEAL_FORM_SESSION_STORAGE_KEY,
  DEFAULT_DEAL_FORM_FIELDS,
  loadDealFormSession,
  writeDealFormSession,
} from "./deal-form-session";

describe("deal-form-session", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("round-trips flow and fields", () => {
    writeDealFormSession({
      flow: "refinance",
      fields: { ...DEFAULT_DEAL_FORM_FIELDS, payoffAmount: "300000" },
    });
    const loaded = loadDealFormSession();
    expect(loaded?.flow).toBe("refinance");
    expect(loaded?.fields.payoffAmount).toBe("300000");
  });

  it("returns null for missing key", () => {
    expect(loadDealFormSession()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, "{");
    expect(loadDealFormSession()).toBeNull();
  });
});
