/** Frozen v1 kinds — CONFIG-001. */
export const RULE_TYPES = [
  "rates",
  "calculator_assumptions",
  "rural_rules",
] as const;

export type RuleType = (typeof RULE_TYPES)[number];

/** Rural rules remain a legacy storage type but are no longer offered in the product. */
export const ACTIVE_RULE_TYPES = [
  "rates",
  "calculator_assumptions",
] as const satisfies readonly RuleType[];

export type ActiveRuleType = (typeof ACTIVE_RULE_TYPES)[number];

export const RULE_STATUSES = ["draft", "published", "archived"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];
