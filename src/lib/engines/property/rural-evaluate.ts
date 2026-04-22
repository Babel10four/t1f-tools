/**
 * Deterministic rural screening from published `rural_rules.evaluation` only (TICKET-008).
 */
import type { RuralRulesEvaluationV1 } from "@/lib/rule-sets/validate-payload";
import type {
  PropertyRuralRequestV1,
  PropertyRuralResponseV1,
  RuralCheckCertainty,
  RuralCheckResult,
} from "./rural-types";

export const RURAL_SCREENING_DISCLAIMER =
  "Internal screening only—not a final determination of rural eligibility, legal status, or regulatory compliance. Escalate borderline cases to policy or compliance.";

/** Static response when no usable inputs (before rule evaluation). */
export function insufficientInfoSparse(
  ruleSetMeta: PropertyRuralResponseV1["ruleSet"],
  ruralPolicyMeta: PropertyRuralResponseV1["ruralPolicy"],
  options?: {
    alsoWarnMissingPublishedRules?: boolean;
    enrichment?: PropertyRuralResponseV1["enrichment"];
    addressLookupFailed?: boolean;
  },
): PropertyRuralResponseV1 {
  const warnings = [
    options?.addressLookupFailed
      ? "Address lookup did not produce enough structured location signals. Add population, MSA status, user rural indicator, or explicit state/county/municipality, or try a fuller street address."
      : "Provide at least one of: population, MSA status, user rural indicator, state, county, or municipality to run screening.",
  ];
  if (options?.alsoWarnMissingPublishedRules) {
    warnings.push(
      "Published rural rules not configured — resolve CONTENT-002 bindings for rural_checker + rural_rules_rule_set for scored output.",
    );
  }
  if (options?.enrichment?.warnings?.length) {
    warnings.push(...options.enrichment.warnings);
  }
  return {
    result: "insufficient_info",
    certainty: "low",
    reasons: [],
    warnings,
    ruleSet: ruleSetMeta,
    ruralPolicy: ruralPolicyMeta,
    disclaimer: RURAL_SCREENING_DISCLAIMER,
    enrichment: options?.enrichment ?? null,
  };
}

/** When published rural_rules cannot be loaded or validated for use. */
export function noConfigResponse(
  ruralPolicyMeta: PropertyRuralResponseV1["ruralPolicy"],
  options?: { enrichment?: PropertyRuralResponseV1["enrichment"] },
): PropertyRuralResponseV1 {
  const warnings = [
    "Published rural rules not configured — resolve CONTENT-002 bindings for rural_checker + rural_rules_rule_set, or fix the published payload.",
  ];
  if (options?.enrichment?.warnings?.length) {
    warnings.push(...options.enrichment.warnings);
  }
  return {
    result: "insufficient_info",
    certainty: "low",
    reasons: [],
    warnings,
    ruleSet: null,
    ruralPolicy: ruralPolicyMeta,
    disclaimer: RURAL_SCREENING_DISCLAIMER,
    enrichment: options?.enrichment ?? null,
  };
}

export function hasScreeningContext(req: PropertyRuralRequestV1): boolean {
  if (req.population !== undefined && Number.isFinite(req.population)) {
    return true;
  }
  if (req.isInMsa !== undefined) {
    return true;
  }
  if (req.userProvidedRuralIndicator !== undefined) {
    return true;
  }
  if (req.state !== undefined && String(req.state).trim() !== "") {
    return true;
  }
  if (req.county !== undefined && String(req.county).trim() !== "") {
    return true;
  }
  if (req.municipality !== undefined && String(req.municipality).trim() !== "") {
    return true;
  }
  return false;
}

/**
 * Compute integer score and reasons from inputs + evaluation block (all thresholds from payload).
 */
export function evaluateRuralScore(
  req: PropertyRuralRequestV1,
  ev: RuralRulesEvaluationV1,
): { score: number; reasons: string[]; warnings: string[]; conflict: boolean } {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let conflict = false;

  const { population, msa, userRuralIndicator, scores } = ev;

  if (req.population !== undefined && Number.isFinite(req.population)) {
    const p = req.population;
    const ruralLean = p <= population.likelyRuralIfLte;
    const notRuralLean = p >= population.likelyNotRuralIfGte;
    if (ruralLean && notRuralLean) {
      conflict = true;
      reasons.push(
        `Population ${p} satisfies both rural-lean and non-rural-lean thresholds (check published rule configuration).`,
      );
    } else if (ruralLean) {
      score += population.scoreIfRuralLean;
      reasons.push(
        `Population ${p} is at or below the rural-lean threshold (${population.likelyRuralIfLte}).`,
      );
    } else if (notRuralLean) {
      score += population.scoreIfNotRuralLean;
      reasons.push(
        `Population ${p} is at or above the non-rural-lean threshold (${population.likelyNotRuralIfGte}).`,
      );
    } else {
      score += population.scoreIfBetween;
      reasons.push(
        `Population ${p} is between configured thresholds (${population.likelyRuralIfLte}–${population.likelyNotRuralIfGte}); band score applied.`,
      );
    }
  } else {
    score += population.scoreIfMissing;
    if (population.scoreIfMissing !== 0) {
      reasons.push("Population was not provided; missing-input score applied for population.");
    }
  }

  if (req.isInMsa !== undefined) {
    if (req.isInMsa === true) {
      if (msa.likelyNotRuralIfTrue) {
        score += msa.scoreIfInMsaPenalty;
        reasons.push(
          "Location is in an MSA; published rules apply the configured MSA non-rural lean signal.",
        );
      } else {
        score += msa.scoreIfInMsaNoPenalty;
        reasons.push(
          "Location is in an MSA; published rules apply the configured in-MSA signal (penalty flag off).",
        );
      }
    } else {
      score += msa.scoreIfNotInMsa;
      reasons.push("Location is not flagged as in an MSA.");
    }
  } else {
    score += msa.scoreIfMissing;
    if (msa.scoreIfMissing !== 0) {
      reasons.push("MSA status was not provided; missing-input score applied for MSA.");
    }
  }

  if (req.userProvidedRuralIndicator !== undefined) {
    if (req.userProvidedRuralIndicator === true) {
      score += userRuralIndicator.scoreIfTrue;
      reasons.push(
        userRuralIndicator.likelyRuralIfTrue
          ? "User indicated the location is rural (aligned with published indicator semantics)."
          : "User indicated the location is rural (per published scoring weights).",
      );
    } else {
      score += userRuralIndicator.scoreIfFalse;
      reasons.push("User indicated the location is not rural.");
    }
  } else {
    score += userRuralIndicator.scoreIfMissing;
    if (userRuralIndicator.scoreIfMissing !== 0) {
      reasons.push(
        "User rural indicator was not provided; missing-input score applied for that signal.",
      );
    }
  }

  if (req.state?.trim() || req.county?.trim() || req.municipality?.trim()) {
    reasons.push(
      "Location labels (state/county/municipality) were provided for context only; they do not change the numeric score in v1.",
    );
  }

  const result = mapScoreToResult(score, conflict, scores);
  if (result === "needs_review" && !conflict) {
    warnings.push(
      "Score fell in the review band or between clear bands—human review suggested.",
    );
  }

  return { score, reasons, warnings, conflict };
}

function mapScoreToResult(
  score: number,
  conflict: boolean,
  scores: RuralRulesEvaluationV1["scores"],
): RuralCheckResult {
  if (conflict) {
    return "needs_review";
  }
  if (score >= scores.likelyRuralMin) {
    return "likely_rural";
  }
  if (score <= scores.likelyNotRuralMax) {
    return "likely_not_rural";
  }
  if (score >= scores.needsReviewBandMin && score <= scores.needsReviewBandMax) {
    return "needs_review";
  }
  return "needs_review";
}

export function certaintyForResult(
  result: RuralCheckResult,
  conflict: boolean,
): RuralCheckCertainty {
  if (result === "insufficient_info") {
    return "low";
  }
  if (result === "needs_review" || conflict) {
    return "medium";
  }
  return "high";
}

export function finalizeEvaluation(
  req: PropertyRuralRequestV1,
  ev: RuralRulesEvaluationV1,
  ruleSetMeta: PropertyRuralResponseV1["ruleSet"],
  ruralPolicyMeta: PropertyRuralResponseV1["ruralPolicy"],
  enrichment: PropertyRuralResponseV1["enrichment"] = null,
): PropertyRuralResponseV1 {
  const { score, reasons, warnings, conflict } = evaluateRuralScore(req, ev);
  const scores = ev.scores;
  const result = mapScoreToResult(score, conflict, scores);

  return {
    result,
    certainty: certaintyForResult(result, conflict),
    reasons,
    warnings,
    ruleSet: ruleSetMeta,
    ruralPolicy: ruralPolicyMeta,
    disclaimer: RURAL_SCREENING_DISCLAIMER,
    enrichment,
  };
}
