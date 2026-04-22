import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { resetDbClientForTests, getDb } from "@/db/client";
import { documents, ruleSets } from "@/db/schema";
import { applyRuleSetsIntegrationSchema } from "@/test/rule-sets-integration-schema";
import {
  archiveRuleSet,
  getPublishedRuleSetByType,
  getRuleSet,
  insertRuleSet,
  publishRuleSet,
  rollbackRuleSet,
} from "./service";
import type { ValidatedPayload } from "./validate-payload";

const integrationUrl = process.env.RULE_SETS_INTEGRATION_DATABASE_URL ?? "";

const ratesPayload = (): ValidatedPayload => ({
  schemaVersion: 1,
  rateTables: [
    { id: "t1", label: "Table", rows: [{ term: "12m", rate: 7.5 }] },
  ],
});

const calcPayload = (): ValidatedPayload => ({
  schemaVersion: 1,
  assumptions: { maxLtv: 80 },
});

const ruralPayload = (): ValidatedPayload => ({
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
  rules: [{ id: "r1", threshold: 1 }],
});

async function truncateAll(): Promise<void> {
  const db = getDb();
  await db.execute(
    sql.raw("TRUNCATE TABLE rule_sets, documents RESTART IDENTITY CASCADE"),
  );
}

async function seedDocumentRow(): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.insert(documents).values({
    id,
    seriesId: randomUUID(),
    docType: "policy",
    title: "Integration doc",
    versionLabel: "v1",
    status: "published",
    storageKey: "integration/test.pdf",
  });
  return id;
}

describe.runIf(integrationUrl.length > 0)(
  "rule_sets service lifecycle (Postgres integration)",
  () => {
    beforeAll(async () => {
      process.env.DATABASE_URL = integrationUrl;
      await resetDbClientForTests();
      await applyRuleSetsIntegrationSchema(integrationUrl);
      await resetDbClientForTests();
      process.env.DATABASE_URL = integrationUrl;
    });

    beforeEach(async () => {
      await truncateAll();
    });

    afterAll(async () => {
      await resetDbClientForTests();
    });

    it("insertRuleSet persists draft rows", async () => {
      const id = randomUUID();
      const row = await insertRuleSet({
        id,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "v1",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      expect(row.status).toBe("draft");
      expect(row.id).toBe(id);
      const again = await getRuleSet(id);
      expect(again?.jsonPayload).toEqual(expect.objectContaining({ schemaVersion: 1 }));
    });

    it("insertRuleSet rejects missing source_document_id", async () => {
      await expect(
        insertRuleSet({
          id: randomUUID(),
          seriesId: randomUUID(),
          ruleType: "rates",
          versionLabel: "v1",
          effectiveDate: null,
          jsonPayload: ratesPayload(),
          sourceDocumentId: "00000000-0000-4000-8000-000000000001",
          createdByRole: "admin",
        }),
      ).rejects.toThrow("SOURCE_DOCUMENT_NOT_FOUND");
    });

    it("insertRuleSet accepts valid source_document_id", async () => {
      const docId = await seedDocumentRow();
      const id = randomUUID();
      const row = await insertRuleSet({
        id,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "v1",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: docId,
        createdByRole: "admin",
      });
      expect(row.sourceDocumentId).toBe(docId);
    });

    it("publishRuleSet archives prior published row of same rule_type then promotes draft", async () => {
      const s1 = randomUUID();
      const d1 = randomUUID();
      const d2 = randomUUID();
      await insertRuleSet({
        id: d1,
        seriesId: s1,
        ruleType: "rates",
        versionLabel: "v1",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(d1);
      const p1 = await getRuleSet(d1);
      expect(p1?.status).toBe("published");

      await insertRuleSet({
        id: d2,
        seriesId: s1,
        ruleType: "rates",
        versionLabel: "v2",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(d2);

      const after = await getRuleSet(d1);
      const pub = await getRuleSet(d2);
      expect(after?.status).toBe("archived");
      expect(after?.archivedAt).not.toBeNull();
      expect(pub?.status).toBe("published");
    });

    it("enforces at most one published row per rule_type (DB unique index)", async () => {
      const db = getDb();
      const idA = randomUUID();
      const idB = randomUUID();
      const series = randomUUID();
      await insertRuleSet({
        id: idA,
        seriesId: series,
        ruleType: "rural_rules",
        versionLabel: "a",
        effectiveDate: null,
        jsonPayload: ruralPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(idA);

      await expect(
        db.execute(sql.raw(`
          INSERT INTO rule_sets (id, series_id, rule_type, version_label, status, json_payload)
          VALUES (
            '${idB}',
            '${series}',
            'rural_rules',
            'evil',
            'published',
            '{"schemaVersion":1,"rules":[]}'::jsonb
          )
        `)),
      ).rejects.toThrow();
    });

    it("cross-type isolation: publishing rates does not change calculator_assumptions published", async () => {
      const calcId = randomUUID();
      await insertRuleSet({
        id: calcId,
        seriesId: randomUUID(),
        ruleType: "calculator_assumptions",
        versionLabel: "c1",
        effectiveDate: null,
        jsonPayload: calcPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(calcId);
      const before = await getPublishedRuleSetByType("calculator_assumptions");
      expect(before?.id).toBe(calcId);

      const ratesDraft = randomUUID();
      await insertRuleSet({
        id: ratesDraft,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "r1",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(ratesDraft);

      const after = await getPublishedRuleSetByType("calculator_assumptions");
      expect(after?.id).toBe(calcId);
      expect(after?.versionLabel).toBe("c1");
    });

    it("rollbackRuleSet archives current published and restores archived row", async () => {
      const v1 = randomUUID();
      const v2 = randomUUID();
      await insertRuleSet({
        id: v1,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "v1",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(v1);

      await insertRuleSet({
        id: v2,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "v2",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await publishRuleSet(v2);

      expect((await getRuleSet(v1))?.status).toBe("archived");
      expect((await getRuleSet(v2))?.status).toBe("published");

      await rollbackRuleSet(v1);

      expect((await getRuleSet(v1))?.status).toBe("published");
      expect((await getRuleSet(v2))?.status).toBe("archived");
      const pub = await getPublishedRuleSetByType("rates");
      expect(pub?.id).toBe(v1);
      expect(pub?.versionLabel).toBe("v1");
    });

    it("archiveRuleSet moves draft to archived", async () => {
      const id = randomUUID();
      await insertRuleSet({
        id,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "draft-only",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: null,
        createdByRole: "admin",
      });
      await archiveRuleSet(id);
      const row = await getRuleSet(id);
      expect(row?.status).toBe("archived");
      expect(row?.archivedAt).not.toBeNull();
    });

    it("source_document_id is set null when referenced document is deleted", async () => {
      const docId = await seedDocumentRow();
      const rsId = randomUUID();
      await insertRuleSet({
        id: rsId,
        seriesId: randomUUID(),
        ruleType: "rates",
        versionLabel: "with-doc",
        effectiveDate: null,
        jsonPayload: ratesPayload(),
        sourceDocumentId: docId,
        createdByRole: "admin",
      });
      const db = getDb();
      await db.delete(documents).where(eq(documents.id, docId));
      const row = await getRuleSet(rsId);
      expect(row?.sourceDocumentId).toBeNull();
    });

    it("counts published rows per rule_type as at most one after publish churn", async () => {
      const db = getDb();
      for (const kind of ["rates", "calculator_assumptions", "rural_rules"] as const) {
        const payload: ValidatedPayload =
          kind === "rates"
            ? ratesPayload()
            : kind === "calculator_assumptions"
              ? calcPayload()
              : ruralPayload();
        const id = randomUUID();
        await insertRuleSet({
          id,
          seriesId: randomUUID(),
          ruleType: kind,
          versionLabel: "p1",
          effectiveDate: null,
          jsonPayload: payload,
          sourceDocumentId: null,
          createdByRole: "admin",
        });
        await publishRuleSet(id);
      }
      const published = await db
        .select({ ruleType: ruleSets.ruleType })
        .from(ruleSets)
        .where(eq(ruleSets.status, "published"));
      expect(published).toHaveLength(3);
      const types = new Set(published.map((r) => r.ruleType));
      expect(types.size).toBe(3);
    });
  },
);
