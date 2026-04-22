/**
 * Server-only: resolve published rule_sets via CONTENT-002 for deal engine policy.
 * @see docs/specs/POLICY-ADOPTION-001.md
 */
import { resolveToolBinding } from "@/lib/bindings/resolve";
import { validateRulePayload } from "@/lib/rule-sets/validate-payload";
import {
  DEAL_ENGINE_BINDING_CALCULATOR,
  DEAL_ENGINE_BINDING_RATES,
  DEAL_ENGINE_TOOL_KEY,
  extractDealEngineRatesFromPayload,
  getFallbackPolicySnapshot,
  parseCalculatorAssumptionsRecord,
  type DealAnalyzePolicySnapshot,
} from "./policy-snapshot";

/**
 * One snapshot per analyze request — safe on missing DB, missing bindings, or invalid payloads.
 */
export async function resolveDealAnalyzePolicy(): Promise<DealAnalyzePolicySnapshot> {
  try {
    return await resolveDealAnalyzePolicyInner();
  } catch {
    return getFallbackPolicySnapshot();
  }
}

async function resolveDealAnalyzePolicyInner(): Promise<DealAnalyzePolicySnapshot> {
  const calcResult = await resolveToolBinding(
    DEAL_ENGINE_TOOL_KEY,
    DEAL_ENGINE_BINDING_CALCULATOR,
  );

  let calculator = null;
  if (calcResult.state === "resolved" && calcResult.kind === "rule_set") {
    const rawPayload = calcResult.ruleSet.jsonPayload;
    const validated = validateRulePayload(
      "calculator_assumptions",
      rawPayload,
    );
    if (validated.ok && "assumptions" in validated.payload) {
      calculator = parseCalculatorAssumptionsRecord(
        validated.payload.assumptions,
      );
    }
  }

  if (!calculator) {
    return getFallbackPolicySnapshot();
  }

  let rates = null;
  const ratesResult = await resolveToolBinding(
    DEAL_ENGINE_TOOL_KEY,
    DEAL_ENGINE_BINDING_RATES,
  );
  if (ratesResult.state === "resolved" && ratesResult.kind === "rule_set") {
    const rawPayload = ratesResult.ruleSet.jsonPayload;
    const validated = validateRulePayload("rates", rawPayload);
    if (validated.ok && "rateTables" in validated.payload) {
      rates = extractDealEngineRatesFromPayload(validated.payload);
    }
  }

  return {
    source: "published",
    calculator,
    rates,
  };
}
