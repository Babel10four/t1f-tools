import type { BindingTypeV1 } from "@/db/schema";
import type { DocumentRow } from "@/db/schema";
import type { RuleSetRow } from "@/db/schema";
import type { DocumentType } from "@/lib/documents/constants";
import { bindingTypeUsesDocument, bindingTypeUsesRuleSet } from "./constants";

export function expectedDocumentType(
  bindingType: BindingTypeV1,
): DocumentType | null {
  if (bindingType === "credit_policy_document") {
    return "credit_policy";
  }
  if (bindingType === "rural_policy_document") {
    return "rural_policy";
  }
  return null;
}

export function expectedRuleType(
  bindingType: BindingTypeV1,
): "rates" | "calculator_assumptions" | "rural_rules" | null {
  if (bindingType === "rates_rule_set") {
    return "rates";
  }
  if (bindingType === "calculator_assumptions_rule_set") {
    return "calculator_assumptions";
  }
  if (bindingType === "rural_rules_rule_set") {
    return "rural_rules";
  }
  return null;
}

export function documentMatchesBindingType(
  bindingType: BindingTypeV1,
  doc: DocumentRow,
): boolean {
  if (!bindingTypeUsesDocument(bindingType)) {
    return false;
  }
  const exp = expectedDocumentType(bindingType);
  return exp !== null && doc.docType === exp;
}

export function ruleSetMatchesBindingType(
  bindingType: BindingTypeV1,
  row: RuleSetRow,
): boolean {
  if (!bindingTypeUsesRuleSet(bindingType)) {
    return false;
  }
  const exp = expectedRuleType(bindingType);
  return exp !== null && row.ruleType === exp;
}
