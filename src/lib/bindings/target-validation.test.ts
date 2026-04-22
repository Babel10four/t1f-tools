import { describe, expect, it } from "vitest";
import {
  documentMatchesBindingType,
  ruleSetMatchesBindingType,
} from "./target-validation";

describe("target-validation (CONTENT-002)", () => {
  it("credit_policy_document matches only credit_policy docs", () => {
    expect(
      documentMatchesBindingType("credit_policy_document", {
        docType: "credit_policy",
      } as never),
    ).toBe(true);
    expect(
      documentMatchesBindingType("credit_policy_document", {
        docType: "rural_policy",
      } as never),
    ).toBe(false);
  });

  it("rates_rule_set matches only rates rule_sets", () => {
    expect(
      ruleSetMatchesBindingType("rates_rule_set", {
        ruleType: "rates",
      } as never),
    ).toBe(true);
    expect(
      ruleSetMatchesBindingType("rates_rule_set", {
        ruleType: "rural_rules",
      } as never),
    ).toBe(false);
  });
});
