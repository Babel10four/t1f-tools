import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { POST as POST_PUBLISH } from "./[id]/publish/route";
import { POST as POST_ROLLBACK } from "./[id]/rollback/route";
import { POST as POST_ARCHIVE } from "./[id]/archive/route";
import * as session from "@/lib/auth/session-server";
import * as service from "@/lib/rule-sets/service";

vi.mock("@/lib/auth/session-server");
vi.mock("@/lib/rule-sets/service");

const adminSession = { role: "admin" as const, sid: "sid" };

const validRatesPayload = {
  schemaVersion: 1,
  rateTables: [
    { id: "t", label: "L", rows: [{ term: "12m", rate: 8 }] },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/admin/rule-sets", () => {
  it("returns 403 for non-admin", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue({
      role: "user",
      sid: "s",
    });
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(403);
  });

  it("returns rule sets for admin", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.listRuleSets).mockResolvedValue([]);
    const res = await GET(new Request("http://x"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ruleSets: unknown[] };
    expect(body.ruleSets).toEqual([]);
    expect(service.listRuleSets).toHaveBeenCalledWith({});
  });

  it("passes filters from query string", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.listRuleSets).mockResolvedValue([]);
    await GET(
      new Request("http://x?rule_type=rates&status=published"),
    );
    expect(service.listRuleSets).toHaveBeenCalledWith({
      ruleType: "rates",
      status: "published",
    });
  });
});

describe("POST /api/admin/rule-sets", () => {
  it("returns 400 for invalid JSON", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid rule_type", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          rule_type: "bogus",
          version_label: "v",
          json_payload: validRatesPayload,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid payload shape", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          rule_type: "rates",
          version_label: "v1",
          json_payload: { schemaVersion: 1, rateTables: "nope" },
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates draft with validated payload", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    const created = {
      id: "new-id",
      seriesId: "ser",
      ruleType: "rates" as const,
      versionLabel: "v1",
      effectiveDate: null,
      status: "draft" as const,
      jsonPayload: validRatesPayload as Record<string, unknown>,
      sourceDocumentId: null,
      createdAt: new Date(),
      publishedAt: null,
      archivedAt: null,
      createdByRole: "admin",
    };
    vi.mocked(service.insertRuleSet).mockResolvedValue(created as never);
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          rule_type: "rates",
          version_label: "v1",
          json_payload: validRatesPayload,
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(service.insertRuleSet).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleType: "rates",
        versionLabel: "v1",
        jsonPayload: expect.objectContaining({ schemaVersion: 1 }),
        createdByRole: "admin",
      }),
    );
  });

  it("returns 400 when source_document_id missing", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.insertRuleSet).mockRejectedValue(
      new Error("SOURCE_DOCUMENT_NOT_FOUND"),
    );
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          rule_type: "rates",
          version_label: "v1",
          json_payload: validRatesPayload,
          source_document_id: "00000000-0000-4000-8000-000000000001",
        }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("source_document");
  });
});

describe("PATCH /api/admin/rule-sets/[id]", () => {
  const draftRow = {
    id: "rid",
    seriesId: "s",
    ruleType: "rates" as const,
    versionLabel: "v",
    effectiveDate: null,
    status: "draft" as const,
    jsonPayload: validRatesPayload as Record<string, unknown>,
    sourceDocumentId: null,
    createdAt: new Date(),
    publishedAt: null,
    archivedAt: null,
    createdByRole: "admin",
  };

  it("rejects invalid json_payload for existing rule type", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.getRuleSet).mockResolvedValue(draftRow as never);
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({
          json_payload: { schemaVersion: 1, rateTables: "bad" },
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rid" }) },
    );
    expect(res.status).toBe(400);
    expect(service.updateRuleSetDraft).not.toHaveBeenCalled();
  });

  it("updates draft when payload valid", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.getRuleSet).mockResolvedValue(draftRow as never);
    vi.mocked(service.updateRuleSetDraft).mockResolvedValue(draftRow as never);
    const res = await PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({
          json_payload: validRatesPayload,
        }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "rid" }) },
    );
    expect(res.status).toBe(200);
    expect(service.updateRuleSetDraft).toHaveBeenCalled();
  });
});

describe("publish / rollback / archive", () => {
  it("publish returns 400 on INVALID_STATE", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.publishRuleSet).mockRejectedValue(
      new Error("INVALID_STATE"),
    );
    const res = await POST_PUBLISH(new Request("http://x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("rollback returns 400 on INVALID_STATE", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.rollbackRuleSet).mockRejectedValue(
      new Error("INVALID_STATE"),
    );
    const res = await POST_ROLLBACK(new Request("http://x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("archive returns 400 when already archived", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue(adminSession);
    vi.mocked(service.archiveRuleSet).mockRejectedValue(
      new Error("INVALID_STATE"),
    );
    const res = await POST_ARCHIVE(new Request("http://x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
