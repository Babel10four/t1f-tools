import { describe, expect, it } from "vitest";
import type { RuralRulesEvaluationV1 } from "@/lib/rule-sets/validate-payload";
import {
  evaluateRuralScore,
  finalizeEvaluation,
  hasScreeningContext,
  insufficientInfoSparse,
  noConfigResponse,
} from "./rural-evaluate";
import type { PropertyRuralRequestV1 } from "./rural-types";

const sampleEval: RuralRulesEvaluationV1 = {
  version: 1,
  population: {
    likelyRuralIfLte: 50_000,
    likelyNotRuralIfGte: 250_000,
    scoreIfRuralLean: 2,
    scoreIfNotRuralLean: -2,
    scoreIfBetween: 0,
    scoreIfMissing: 0,
  },
  msa: {
    likelyNotRuralIfTrue: true,
    scoreIfInMsaPenalty: -2,
    scoreIfInMsaNoPenalty: 0,
    scoreIfNotInMsa: 1,
    scoreIfMissing: 0,
  },
  userRuralIndicator: {
    likelyRuralIfTrue: true,
    scoreIfTrue: 1,
    scoreIfFalse: -1,
    scoreIfMissing: 0,
  },
  scores: {
    likelyRuralMin: 2,
    likelyNotRuralMax: -1,
    needsReviewBandMin: -1,
    needsReviewBandMax: 1,
  },
};

describe("rural-evaluate (TICKET-008)", () => {
  it("hasScreeningContext is true when any structured field is present", () => {
    expect(hasScreeningContext({ state: "TX" })).toBe(true);
    expect(hasScreeningContext({ population: 100 })).toBe(true);
    expect(hasScreeningContext({})).toBe(false);
  });

  it("produces likely_rural when score meets likelyRuralMin", () => {
    const req: PropertyRuralRequestV1 = { population: 40_000 };
    const out = finalizeEvaluation(req, sampleEval, null, null);
    expect(out.result).toBe("likely_rural");
    expect(out.reasons.some((r) => r.includes("40"))).toBe(true);
  });

  it("produces likely_not_rural when score below likelyNotRuralMax", () => {
    const req: PropertyRuralRequestV1 = { population: 300_000 };
    const out = finalizeEvaluation(req, sampleEval, null, null);
    expect(out.result).toBe("likely_not_rural");
  });

  it("returns insufficient_info styling for sparse helper", () => {
    const s = insufficientInfoSparse(null, null, { alsoWarnMissingPublishedRules: true });
    expect(s.result).toBe("insufficient_info");
    expect(s.warnings.length).toBeGreaterThan(0);
  });

  it("noConfigResponse includes Published rural rules not configured warning", () => {
    const n = noConfigResponse(null);
    expect(n.result).toBe("insufficient_info");
    expect(
      n.warnings.some((w) => w.toLowerCase().includes("published rural rules")),
    ).toBe(true);
  });

  it("flags needs_review when score falls in review band", () => {
    const narrow: RuralRulesEvaluationV1 = {
      ...sampleEval,
      scores: {
        likelyRuralMin: 10,
        likelyNotRuralMax: -10,
        needsReviewBandMin: -2,
        needsReviewBandMax: 2,
      },
    };
    const req: PropertyRuralRequestV1 = { population: 100_000 };
    const { score, conflict } = evaluateRuralScore(req, narrow);
    expect(conflict).toBe(false);
    const out = finalizeEvaluation(req, narrow, null, null);
    expect(score).toBe(0);
    expect(out.result).toBe("needs_review");
  });
});
