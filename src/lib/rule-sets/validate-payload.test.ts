import { describe, expect, it } from "vitest";
import { validateRulePayload } from "./validate-payload";

const validRates = {
  schemaVersion: 1,
  rateTables: [
    {
      id: "t1",
      label: "L",
      rows: [{ term: "12m", rate: 8 }],
    },
  ],
};

const validCalc = {
  schemaVersion: 1,
  assumptions: { maxLtv: 75 },
};

const validRuralEvaluation = {
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

const validRural = {
  schemaVersion: 1,
  evaluation: validRuralEvaluation,
  rules: [{ id: "a", threshold: 1 }],
};

describe("validateRulePayload", () => {
  it("accepts valid rates", () => {
    const r = validateRulePayload("rates", validRates);
    expect(r.ok).toBe(true);
    if (r.ok && r.payload.schemaVersion === 1 && "rateTables" in r.payload) {
      expect(r.payload.rateTables).toHaveLength(1);
    }
  });

  it("accepts rates with optional deal-engine pricing scalars", () => {
    const r = validateRulePayload("rates", {
      ...validRates,
      noteRatePercent: 7.5,
      marginBps: 200,
      discountPoints: null,
      lockDays: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok && "noteRatePercent" in r.payload) {
      expect(r.payload.noteRatePercent).toBe(7.5);
      expect(r.payload.discountPoints).toBeNull();
    }
  });

  it("rejects rates with bad row rate", () => {
    const r = validateRulePayload("rates", {
      ...validRates,
      rateTables: [{ id: "x", label: "y", rows: [{ term: "z", rate: NaN }] }],
    });
    expect(r.ok).toBe(false);
  });

  it("accepts valid calculator_assumptions", () => {
    const r = validateRulePayload("calculator_assumptions", validCalc);
    expect(r.ok).toBe(true);
  });

  it("rejects calculator with non-numeric assumption", () => {
    const r = validateRulePayload("calculator_assumptions", {
      schemaVersion: 1,
      assumptions: { x: "nope" },
    });
    expect(r.ok).toBe(false);
  });

  it("accepts valid rural_rules", () => {
    const r = validateRulePayload("rural_rules", validRural);
    expect(r.ok).toBe(true);
  });

  it("rejects rural rule without id", () => {
    const r = validateRulePayload("rural_rules", {
      schemaVersion: 1,
      evaluation: validRuralEvaluation,
      rules: [{ threshold: 1 }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects rural_rules without evaluation", () => {
    const r = validateRulePayload("rural_rules", {
      schemaVersion: 1,
      rules: [{ id: "a" }],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects rural_rules when population thresholds are inconsistent", () => {
    const r = validateRulePayload("rural_rules", {
      schemaVersion: 1,
      evaluation: {
        ...validRuralEvaluation,
        population: {
          ...validRuralEvaluation.population,
          likelyRuralIfLte: 300_000,
          likelyNotRuralIfGte: 250_000,
        },
      },
      rules: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects wrong schemaVersion", () => {
    const r = validateRulePayload("rates", { schemaVersion: 2, rateTables: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects non-object", () => {
    expect(validateRulePayload("rates", null).ok).toBe(false);
    expect(validateRulePayload("rates", []).ok).toBe(false);
  });
});
