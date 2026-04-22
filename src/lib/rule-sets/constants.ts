/** Frozen v1 kinds — CONFIG-001. */
export const RULE_TYPES = [
  "rates",
  "calculator_assumptions",
  "rural_rules",
] as const;

export type RuleType = (typeof RULE_TYPES)[number];

export const RULE_STATUSES = ["draft", "published", "archived"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];
