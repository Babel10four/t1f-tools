import { describe, expect, it } from "vitest";
import {
  publishedRowIdsToArchiveForPublish,
  publishedRowIdsToArchiveForRollback,
} from "./invariants";

describe("publish/rollback isolation by rule_type", () => {
  const mixed = [
    { id: "r1", ruleType: "rates" as const, status: "published" as const },
    {
      id: "c1",
      ruleType: "calculator_assumptions" as const,
      status: "published" as const,
    },
    { id: "d1", ruleType: "rates" as const, status: "draft" as const },
  ];

  it("archives only published rows of the draft rule_type", () => {
    const draft = { ruleType: "rates" as const };
    const ids = publishedRowIdsToArchiveForPublish(draft, mixed);
    expect(ids).toEqual(["r1"]);
  });

  it("does not touch calculator_assumptions when publishing rates", () => {
    const draft = { ruleType: "rates" as const };
    const ids = publishedRowIdsToArchiveForPublish(draft, mixed);
    expect(ids.includes("c1")).toBe(false);
  });

  it("rollback archives other published in same type only", () => {
    const rows = [
      ...mixed,
      { id: "r2", ruleType: "rates" as const, status: "archived" as const },
    ];
    const target = { ruleType: "rates" as const, id: "r2" };
    const ids = publishedRowIdsToArchiveForRollback(target, rows);
    expect(ids).toEqual(["r1"]);
  });
});

describe("published-only resolution", () => {
  it("draft rows are not published snapshots", () => {
    type R = { ruleType: "rates"; status: "draft" | "published" };
    const rows: R[] = [{ ruleType: "rates", status: "draft" }];
    const published = rows.filter(
      (r) => r.ruleType === "rates" && r.status === "published",
    );
    expect(published).toHaveLength(0);
  });
});
