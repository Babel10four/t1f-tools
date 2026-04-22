import { bindingTypesV1, type BindingTypeV1 } from "@/db/schema";

export { bindingTypesV1 };

/** Suggested `tool_key` values (align with analytics + hub); admins may use other stable strings. */
export const SUGGESTED_TOOL_KEYS = [
  "loan_structuring_assistant",
  "pricing_calculator",
  "cash_to_close_estimator",
  "term_sheet",
  "deal_analyzer",
  "credit_copilot",
  "rural_checker",
  "voice_agent",
] as const;

export function isBindingTypeV1(v: string): v is BindingTypeV1 {
  return (bindingTypesV1 as readonly string[]).includes(v);
}

export function bindingTypeUsesDocument(
  t: BindingTypeV1,
): t is "credit_policy_document" | "rural_policy_document" {
  return t === "credit_policy_document" || t === "rural_policy_document";
}

export function bindingTypeUsesRuleSet(
  t: BindingTypeV1,
): t is
  | "rates_rule_set"
  | "calculator_assumptions_rule_set"
  | "rural_rules_rule_set" {
  return (
    t === "rates_rule_set" ||
    t === "calculator_assumptions_rule_set" ||
    t === "rural_rules_rule_set"
  );
}
