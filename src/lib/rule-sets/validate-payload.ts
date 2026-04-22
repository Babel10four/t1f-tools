import type { RuleType } from "./constants";

export type ValidatedPayload =
  | RatesPayload
  | CalculatorAssumptionsPayload
  | RuralRulesPayload;

/** v1 — rate tables / indices for pricing surfaces. */
export type RatesPayload = {
  schemaVersion: 1;
  rateTables: Array<{
    id: string;
    label: string;
    rows: Array<{ term: string; rate: number }>;
  }>;
  /** Optional deal-engine pricing scalars (POLICY-ADOPTION-001); omitted fields stay null in analyze. */
  noteRatePercent?: number | null;
  marginBps?: number | null;
  discountPoints?: number | null;
  lockDays?: number | null;
};

/** v1 — numeric assumptions for calculators (not free-form text). */
export type CalculatorAssumptionsPayload = {
  schemaVersion: 1;
  assumptions: Record<string, number>;
};

/**
 * v1 — structured rural screening (TICKET-008). All numeric policy is in JSON — not hardcoded in code.
 * `rules[]` optional audit labels; evaluation drives scoring.
 */
export type RuralRulesEvaluationV1 = {
  version: 1;
  population: {
    likelyRuralIfLte: number;
    likelyNotRuralIfGte: number;
    scoreIfRuralLean: number;
    scoreIfNotRuralLean: number;
    /** Applied when population is strictly between rural-lean and non-rural-lean thresholds. */
    scoreIfBetween: number;
    scoreIfMissing: number;
  };
  msa: {
    likelyNotRuralIfTrue: boolean;
    /** When `isInMsa === true` and `likelyNotRuralIfTrue` is true (MSA non-rural lean). */
    scoreIfInMsaPenalty: number;
    /** When `isInMsa === true` and `likelyNotRuralIfTrue` is false. */
    scoreIfInMsaNoPenalty: number;
    /** When `isInMsa === false`. */
    scoreIfNotInMsa: number;
    scoreIfMissing: number;
  };
  userRuralIndicator: {
    likelyRuralIfTrue: boolean;
    scoreIfTrue: number;
    scoreIfFalse: number;
    scoreIfMissing: number;
  };
  scores: {
    likelyRuralMin: number;
    likelyNotRuralMax: number;
    needsReviewBandMin: number;
    needsReviewBandMax: number;
  };
};

export type RuralRulesPayload = {
  schemaVersion: 1;
  evaluation: RuralRulesEvaluationV1;
  rules: Array<{
    id: string;
    description?: string;
    threshold?: number;
  }>;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateRulePayload(
  ruleType: RuleType,
  raw: unknown,
):
  | { ok: true; payload: ValidatedPayload }
  | { ok: false; error: string } {
  if (!isObject(raw)) {
    return { ok: false, error: "Payload must be a JSON object" };
  }
  if (raw.schemaVersion !== 1) {
    return { ok: false, error: "schemaVersion must be 1" };
  }

  switch (ruleType) {
    case "rates":
      return validateRates(raw);
    case "calculator_assumptions":
      return validateCalculator(raw);
    case "rural_rules":
      return validateRural(raw);
    default: {
      const _exhaustive: never = ruleType;
      return { ok: false, error: `Unknown rule_type: ${_exhaustive}` };
    }
  }
}

function validateRates(
  raw: Record<string, unknown>,
): { ok: true; payload: RatesPayload } | { ok: false; error: string } {
  if (!Array.isArray(raw.rateTables)) {
    return { ok: false, error: "rates.rateTables must be an array" };
  }
  for (let i = 0; i < raw.rateTables.length; i++) {
    const t = raw.rateTables[i];
    if (!isObject(t)) {
      return { ok: false, error: `rateTables[${i}] must be an object` };
    }
    if (typeof t.id !== "string" || t.id.trim() === "") {
      return { ok: false, error: `rateTables[${i}].id must be a non-empty string` };
    }
    if (typeof t.label !== "string") {
      return { ok: false, error: `rateTables[${i}].label must be a string` };
    }
    if (!Array.isArray(t.rows)) {
      return { ok: false, error: `rateTables[${i}].rows must be an array` };
    }
    for (let j = 0; j < t.rows.length; j++) {
      const r = t.rows[j];
      if (!isObject(r)) {
        return { ok: false, error: `rateTables[${i}].rows[${j}] must be an object` };
      }
      if (typeof r.term !== "string") {
        return { ok: false, error: `rows[${j}].term must be a string` };
      }
      if (!isFiniteNumber(r.rate)) {
        return { ok: false, error: `rows[${j}].rate must be a finite number` };
      }
    }
  }

  const optionalPricing = [
    "noteRatePercent",
    "marginBps",
    "discountPoints",
    "lockDays",
  ] as const;
  for (const key of optionalPricing) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v === null) continue;
    if (!isFiniteNumber(v)) {
      return { ok: false, error: `rates.${key} must be a finite number or null` };
    }
  }

  const payload: RatesPayload = {
    schemaVersion: 1,
    rateTables: raw.rateTables as RatesPayload["rateTables"],
    ...(raw.noteRatePercent !== undefined
      ? { noteRatePercent: raw.noteRatePercent as number | null }
      : {}),
    ...(raw.marginBps !== undefined
      ? { marginBps: raw.marginBps as number | null }
      : {}),
    ...(raw.discountPoints !== undefined
      ? { discountPoints: raw.discountPoints as number | null }
      : {}),
    ...(raw.lockDays !== undefined
      ? { lockDays: raw.lockDays as number | null }
      : {}),
  };
  return { ok: true, payload };
}

function validateCalculator(
  raw: Record<string, unknown>,
):
  | { ok: true; payload: CalculatorAssumptionsPayload }
  | { ok: false; error: string } {
  if (!isObject(raw.assumptions)) {
    return { ok: false, error: "calculator_assumptions.assumptions must be an object" };
  }
  for (const [k, v] of Object.entries(raw.assumptions)) {
    if (!isFiniteNumber(v)) {
      return {
        ok: false,
        error: `assumptions.${k} must be a finite number`,
      };
    }
  }
  const payload: CalculatorAssumptionsPayload = {
    schemaVersion: 1,
    assumptions: raw.assumptions as CalculatorAssumptionsPayload["assumptions"],
  };
  return { ok: true, payload };
}

function validateRural(
  raw: Record<string, unknown>,
): { ok: true; payload: RuralRulesPayload } | { ok: false; error: string } {
  if (!isObject(raw.evaluation)) {
    return { ok: false, error: "rural_rules.evaluation is required" };
  }
  const ev = raw.evaluation;
  if (ev.version !== 1) {
    return { ok: false, error: "rural_rules.evaluation.version must be 1" };
  }
  if (!isObject(ev.population) || !isObject(ev.msa) || !isObject(ev.userRuralIndicator) || !isObject(ev.scores)) {
    return { ok: false, error: "rural_rules.evaluation.population/msa/userRuralIndicator/scores must be objects" };
  }
  const pop = ev.population;
  for (const k of [
    "likelyRuralIfLte",
    "likelyNotRuralIfGte",
    "scoreIfRuralLean",
    "scoreIfNotRuralLean",
    "scoreIfBetween",
    "scoreIfMissing",
  ] as const) {
    if (!isFiniteNumber(pop[k])) {
      return { ok: false, error: `evaluation.population.${k} must be a finite number` };
    }
  }
  const populationNums = pop as {
    likelyRuralIfLte: number;
    likelyNotRuralIfGte: number;
    scoreIfRuralLean: number;
    scoreIfNotRuralLean: number;
    scoreIfBetween: number;
    scoreIfMissing: number;
  };
  if (populationNums.likelyRuralIfLte >= populationNums.likelyNotRuralIfGte) {
    return {
      ok: false,
      error: "evaluation.population.likelyRuralIfLte must be < likelyNotRuralIfGte",
    };
  }
  const msa = ev.msa;
  if (typeof msa.likelyNotRuralIfTrue !== "boolean") {
    return { ok: false, error: "evaluation.msa.likelyNotRuralIfTrue must be a boolean" };
  }
  for (const k of [
    "scoreIfInMsaPenalty",
    "scoreIfInMsaNoPenalty",
    "scoreIfNotInMsa",
    "scoreIfMissing",
  ] as const) {
    if (!isFiniteNumber(msa[k])) {
      return { ok: false, error: `evaluation.msa.${k} must be a finite number` };
    }
  }
  const ur = ev.userRuralIndicator;
  if (typeof ur.likelyRuralIfTrue !== "boolean") {
    return { ok: false, error: "evaluation.userRuralIndicator.likelyRuralIfTrue must be a boolean" };
  }
  for (const k of ["scoreIfTrue", "scoreIfFalse", "scoreIfMissing"] as const) {
    if (!isFiniteNumber(ur[k])) {
      return { ok: false, error: `evaluation.userRuralIndicator.${k} must be a finite number` };
    }
  }
  const sc = ev.scores;
  for (const k of [
    "likelyRuralMin",
    "likelyNotRuralMax",
    "needsReviewBandMin",
    "needsReviewBandMax",
  ] as const) {
    if (!isFiniteNumber(sc[k])) {
      return { ok: false, error: `evaluation.scores.${k} must be a finite number` };
    }
  }
  const scoresNums = sc as {
    likelyRuralMin: number;
    likelyNotRuralMax: number;
    needsReviewBandMin: number;
    needsReviewBandMax: number;
  };
  if (scoresNums.needsReviewBandMin > scoresNums.needsReviewBandMax) {
    return { ok: false, error: "evaluation.scores.needsReviewBandMin must be <= needsReviewBandMax" };
  }

  if (!Array.isArray(raw.rules)) {
    return { ok: false, error: "rural_rules.rules must be an array" };
  }
  for (let i = 0; i < raw.rules.length; i++) {
    const r = raw.rules[i];
    if (!isObject(r)) {
      return { ok: false, error: `rules[${i}] must be an object` };
    }
    if (typeof r.id !== "string" || r.id.trim() === "") {
      return { ok: false, error: `rules[${i}].id must be a non-empty string` };
    }
    if (r.description !== undefined && typeof r.description !== "string") {
      return { ok: false, error: `rules[${i}].description must be a string` };
    }
    if (
      r.threshold !== undefined &&
      !isFiniteNumber(r.threshold)
    ) {
      return { ok: false, error: `rules[${i}].threshold must be a finite number` };
    }
  }
  const payload: RuralRulesPayload = {
    schemaVersion: 1,
    evaluation: ev as RuralRulesEvaluationV1,
    rules: raw.rules as RuralRulesPayload["rules"],
  };
  return { ok: true, payload };
}
