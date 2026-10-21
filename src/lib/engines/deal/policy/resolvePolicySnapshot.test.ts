import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleSetRow } from "@/db/schema";
import * as resolveMod from "@/lib/bindings/resolve";
import {
  DEAL_ENGINE_BINDING_CALCULATOR,
  DEAL_ENGINE_BINDING_RATES,
  DEAL_ENGINE_TOOL_KEY,
} from "./policy-snapshot";
import { POLICY_MAX_LTC_PCT } from "./constants";
import { resolveDealAnalyzePolicy } from "./resolvePolicySnapshot";

vi.mock("@/lib/bindings/resolve", () => ({
  resolveToolBinding: vi.fn(),
}));

const fullCalcAssumptions = {
  maxLtcPct: 0.75,
  maxArvLtvPct: 0.7,
  refinanceMaxLtvPct: 0.75,
  defaultTermMonths: 12,
  ltvOverLimitThresholdPct: 75,
  ctcPointsPct: 0.005,
  ctcLenderFeesPct: 0.01,
  ctcClosingCostsPct: 0.015,
};

function mockRuleSet(
  ruleType: "rates" | "calculator_assumptions",
  jsonPayload: Record<string, unknown>,
): RuleSetRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    seriesId: "00000000-0000-4000-8000-000000000002",
    ruleType,
    versionLabel: "test",
    effectiveDate: null,
    status: "published",
    jsonPayload,
    sourceDocumentId: null,
    createdAt: new Date(),
    publishedAt: new Date(),
    archivedAt: null,
    createdByRole: "admin",
  };
}

describe("resolveDealAnalyzePolicy (POLICY-ADOPTION-001A)", () => {
  beforeEach(() => {
    vi.mocked(resolveMod.resolveToolBinding).mockReset();
  });

  it("invalid published calculator payload → full fallback", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, bindingType) => {
        if (bindingType === DEAL_ENGINE_BINDING_CALCULATOR) {
          return {
            state: "resolved",
            bindingId: "b1",
            kind: "rule_set",
            ruleSet: mockRuleSet("calculator_assumptions", {
              schemaVersion: 1,
              assumptions: { maxLtcPct: 0.75 },
            }),
          };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );

    const snap = await resolveDealAnalyzePolicy();
    expect(snap.source).toBe("fallback");
    expect(snap.rates).toBeNull();
    expect(snap.calculator.maxLtcPct).toBe(POLICY_MAX_LTC_PCT);
  });

  it("valid calculator + invalid rates payload → source published, rates null", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, bindingType) => {
        if (bindingType === DEAL_ENGINE_BINDING_CALCULATOR) {
          return {
            state: "resolved",
            bindingId: "b1",
            kind: "rule_set",
            ruleSet: mockRuleSet("calculator_assumptions", {
              schemaVersion: 1,
              assumptions: fullCalcAssumptions,
            }),
          };
        }
        if (bindingType === DEAL_ENGINE_BINDING_RATES) {
          return {
            state: "resolved",
            bindingId: "b2",
            kind: "rule_set",
            ruleSet: mockRuleSet("rates", {
              schemaVersion: 1,
              rateTables: "not-an-array",
            }),
          };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );

    const snap = await resolveDealAnalyzePolicy();
    expect(snap.source).toBe("published");
    expect(snap.calculator.maxLtcPct).toBe(0.75);
    expect(snap.rates).toBeNull();
  });

  it("resolver throws → fallback", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockRejectedValue(
      new Error("database down"),
    );

    const snap = await resolveDealAnalyzePolicy();
    expect(snap.source).toBe("fallback");
    expect(snap.calculator.maxLtcPct).toBe(POLICY_MAX_LTC_PCT);
  });

  it("missing calculator binding → fallback", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (toolKey, bindingType) => {
        expect(toolKey).toBe(DEAL_ENGINE_TOOL_KEY);
        if (bindingType === DEAL_ENGINE_BINDING_CALCULATOR) {
          return { state: "missing", reason: "no_published_binding" };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );

    const snap = await resolveDealAnalyzePolicy();
    expect(snap.source).toBe("fallback");
  });

  it("missing rates binding with valid calculator → published, rates null", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, bindingType) => {
        if (bindingType === DEAL_ENGINE_BINDING_CALCULATOR) {
          return {
            state: "resolved",
            bindingId: "b1",
            kind: "rule_set",
            ruleSet: mockRuleSet("calculator_assumptions", {
              schemaVersion: 1,
              assumptions: fullCalcAssumptions,
            }),
          };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );

    const snap = await resolveDealAnalyzePolicy();
    expect(snap.source).toBe("published");
    expect(snap.rates).toBeNull();
    expect(snap.calculator.maxLtcPct).toBe(0.75);
  });

  it("passes published tier rules through the calculator snapshot", async () => {
    const purchaseTierRules = { "3": { initialAdvancePct: 0.85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 } };
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(async (_tool, bindingType) => {
      if (bindingType === DEAL_ENGINE_BINDING_CALCULATOR) {
        return { state: "resolved", bindingId: "tier3-binding", kind: "rule_set",
          ruleSet: mockRuleSet("calculator_assumptions", { schemaVersion: 1, assumptions: fullCalcAssumptions, purchaseTierRules }) };
      }
      return { state: "missing", reason: "no_published_binding" };
    });
    const result = await resolveDealAnalyzePolicy();
    expect(result.source).toBe("published");
    expect(result.calculator.purchaseTierRules).toEqual(purchaseTierRules);
  });

  it("does not retain Tier 3 policy on invalid published tier config", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "resolved", bindingId: "invalid", kind: "rule_set",
      ruleSet: mockRuleSet("calculator_assumptions", { schemaVersion: 1, assumptions: fullCalcAssumptions,
        purchaseTierRules: { "3": { initialAdvancePct: 85, rehabAdvancePct: 1, maxArvLtvPct: 0.75 } } }),
    });
    const result = await resolveDealAnalyzePolicy();
    expect(result.source).toBe("fallback");
    expect(result.calculator.purchaseTierRules).toBeUndefined();
  });
});
