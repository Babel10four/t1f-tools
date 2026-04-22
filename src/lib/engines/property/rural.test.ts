import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuleSetRow } from "@/db/schema";
import * as resolveMod from "@/lib/bindings/resolve";
import { runPropertyRural } from "./rural";

vi.mock("@/lib/bindings/resolve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings/resolve")>();
  return {
    ...actual,
    resolveToolBinding: vi.fn(),
  };
});

const publishedPayload = {
  schemaVersion: 1,
  evaluation: {
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
  },
  rules: [],
} as const;

function mockRuleSetRow(): RuleSetRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    seriesId: "00000000-0000-4000-8000-000000000002",
    ruleType: "rural_rules",
    versionLabel: "fixture",
    effectiveDate: null,
    status: "published",
    jsonPayload: { ...publishedPayload },
    sourceDocumentId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    publishedAt: null,
    archivedAt: null,
    createdByRole: null,
  };
}

describe("runPropertyRural (TICKET-008)", () => {
  beforeEach(() => {
    vi.mocked(resolveMod.resolveToolBinding).mockReset();
  });

  it("returns insufficient_info when no binding and no screening context", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, binding) => {
        if (binding === "rural_policy_document") {
          return { state: "missing", reason: "no_published_binding" };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );
    const out = await runPropertyRural({});
    expect(out.result).toBe("insufficient_info");
    expect(out.ruleSet).toBeNull();
  });

  it("returns insufficient_info with warning when binding missing but user gave context", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, binding) => {
        if (binding === "rural_policy_document") {
          return { state: "missing", reason: "no_published_binding" };
        }
        return { state: "missing", reason: "no_published_binding" };
      },
    );
    const out = await runPropertyRural({ state: "TX" });
    expect(out.result).toBe("insufficient_info");
    expect(out.warnings.join(" ")).toMatch(/Published rural rules not configured/i);
    expect(out.ruleSet).toBeNull();
  });

  it("evaluates when rural_rules resolves and policy document resolves", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, binding) => {
        if (binding === "rural_policy_document") {
          return {
            state: "resolved",
            bindingId: "b-doc",
            kind: "document",
            document: {
              id: "00000000-0000-4000-8000-000000000099",
              seriesId: "00000000-0000-4000-8000-000000000098",
              docType: "rural_policy",
              title: "Rural policy",
              versionLabel: "2026-Q1",
              effectiveDate: null,
              status: "published",
              storageKey: "fixture/rural-policy.pdf",
              contentType: "application/pdf",
              byteSize: 1,
              originalFilename: null,
              extractedText: null,
              notes: null,
              createdAt: new Date(),
              publishedAt: null,
              archivedAt: null,
              createdByRole: null,
            },
          };
        }
        return {
          state: "resolved",
          bindingId: "b-rs",
          kind: "rule_set",
          ruleSet: mockRuleSetRow(),
        };
      },
    );
    const out = await runPropertyRural({ population: 40_000 });
    expect(out.result).toBe("likely_rural");
    expect(out.ruleSet).not.toBeNull();
    expect(out.ruralPolicy?.title).toBe("Rural policy");
  });

  it("throws when published json_payload fails validation", async () => {
    const badRow = mockRuleSetRow();
    badRow.jsonPayload = { schemaVersion: 1, rules: [] };
    vi.mocked(resolveMod.resolveToolBinding).mockImplementation(
      async (_tool, binding) => {
        if (binding === "rural_policy_document") {
          return { state: "missing", reason: "no_published_binding" };
        }
        return {
          state: "resolved",
          bindingId: "b-rs",
          kind: "rule_set",
          ruleSet: badRow,
        };
      },
    );
    await expect(
      runPropertyRural({ population: 1 }),
    ).rejects.toThrow(/failed validation/i);
  });
});
