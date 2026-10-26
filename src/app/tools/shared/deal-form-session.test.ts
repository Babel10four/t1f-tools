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

  it("round-trips an explicit refinance scenario", () => {
    writeDealFormSession({
      flow: "refinance",
      fields: { ...DEFAULT_DEAL_FORM_FIELDS, refinanceScenario: "refinance_seasoned" },
    });
    expect(loadDealFormSession()?.fields.refinanceScenario).toBe("refinance_seasoned");
  });

  it("loads pre-scenario sessions without inferring seasoning", () => {
    const legacyFields = { ...DEFAULT_DEAL_FORM_FIELDS };
    delete legacyFields.refinanceScenario;
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, JSON.stringify({
      flow: "refinance",
      fields: legacyFields,
    }));
    expect(loadDealFormSession()?.fields.refinanceScenario).toBe("");
  });

  it("rejects an unknown saved scenario instead of silently changing its calculation", () => {
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, JSON.stringify({
      flow: "refinance",
      fields: { ...DEFAULT_DEAL_FORM_FIELDS, refinanceScenario: "unsupported" },
    }));
    expect(loadDealFormSession()).toBeNull();
  });

  it("clears a stale refinance scenario on purchase load and persistence", () => {
    const payload = {
      flow: "purchase" as const,
      fields: { ...DEFAULT_DEAL_FORM_FIELDS, refinanceScenario: "refinance_seasoned" as const },
    };
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, JSON.stringify(payload));
    expect(loadDealFormSession()?.fields.refinanceScenario).toBe("");
    writeDealFormSession(payload);
    expect(JSON.parse(sessionStorage.getItem(DEAL_FORM_SESSION_STORAGE_KEY)!).fields.refinanceScenario).toBe("");
  });

  it("returns null for invalid JSON", () => {
    sessionStorage.setItem(DEAL_FORM_SESSION_STORAGE_KEY, "{");
    expect(loadDealFormSession()).toBeNull();
  });
});
