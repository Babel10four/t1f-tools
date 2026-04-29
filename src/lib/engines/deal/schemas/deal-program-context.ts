import type { DealAnalyzeProgramScenarioV1 } from "./deal-engine-v1-enums";

/**
 * Typed optional inputs for scenario-aware policy (POLICY-ENGINE-REWRITE).
 * Unknown keys are rejected at validation time.
 */
export type DealAnalyzeProgramContextV1 = {
  scenario?: DealAnalyzeProgramScenarioV1;
  /** Free-text or future enum alignment with product/refi tables. */
  refiSubtype?: string;
  /** Rehab / SOW dollars when distinguished from `deal.rehabBudget` in a future branch. */
  scopeOfWorkAmount?: number;
};
