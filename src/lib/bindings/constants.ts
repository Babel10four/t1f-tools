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
  "voice_agent",
] as const;

/** Rural binding kinds remain in the database schema for historical compatibility only. */
export const ACTIVE_BINDING_TYPES = [
  "credit_policy_document",
  "rates_rule_set",
  "calculator_assumptions_rule_set",
] as const satisfies readonly BindingTypeV1[];

export type ActiveBindingType = (typeof ACTIVE_BINDING_TYPES)[number];

export function isActiveBindingType(
  type: BindingTypeV1,
): type is ActiveBindingType {
  return (ACTIVE_BINDING_TYPES as readonly BindingTypeV1[]).includes(type);
}

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
