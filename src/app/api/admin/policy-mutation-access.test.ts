import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionPayload } from "@/lib/auth/session-server";
import * as ruleSets from "@/lib/rule-sets/service";
import * as bindings from "@/lib/bindings/service";
import * as documents from "@/lib/documents/service";
import * as storage from "@/lib/storage/document-storage";
import { extractPdfTextBestEffort } from "@/lib/documents/extract-text";
import { enqueuePlatformEvent } from "@/lib/analytics/log-event";
import { POST as createRuleSet } from "./rule-sets/route";
import { PATCH as editRuleSet } from "./rule-sets/[id]/route";
import { POST as publishRuleSet } from "./rule-sets/[id]/publish/route";
import { POST as archiveRuleSet } from "./rule-sets/[id]/archive/route";
import { POST as rollbackRuleSet } from "./rule-sets/[id]/rollback/route";
import { POST as createBinding } from "./tool-bindings/route";
import { POST as publishBinding } from "./tool-bindings/[id]/publish/route";
import { POST as archiveBinding } from "./tool-bindings/[id]/archive/route";
import { POST as uploadDocument } from "./documents/upload/route";
import { POST as publishDocument } from "./documents/[id]/publish/route";
import { POST as archiveDocument } from "./documents/[id]/archive/route";
import { POST as rollbackDocument } from "./documents/[id]/rollback/route";

// No database, storage, extraction or analytics writes are made by this suite.
vi.mock("@/lib/auth/session-server", () => ({ getSessionPayload: vi.fn() }));
vi.mock("@/lib/rule-sets/service", () => ({
  insertRuleSet: vi.fn(), getRuleSet: vi.fn(), updateRuleSetDraft: vi.fn(),
  publishRuleSet: vi.fn(), archiveRuleSet: vi.fn(), rollbackRuleSet: vi.fn(),
  listRuleSets: vi.fn(),
}));
vi.mock("@/lib/bindings/service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/bindings/service")>();
  return { ...original, insertBindingDraft: vi.fn(), publishBinding: vi.fn(), archiveBinding: vi.fn() };
});
vi.mock("@/lib/documents/service", () => ({
  insertDocument: vi.fn(), publishDocument: vi.fn(), archiveDocument: vi.fn(), rollbackToDocument: vi.fn(),
}));
vi.mock("@/lib/storage/document-storage", () => ({ putPdfBytes: vi.fn() }));
vi.mock("@/lib/documents/extract-text", () => ({ extractPdfTextBestEffort: vi.fn() }));
vi.mock("@/lib/analytics/log-event", () => ({ enqueuePlatformEvent: vi.fn() }));

const id = "00000000-0000-4000-8000-000000000001";
const context = () => ({ params: Promise.resolve({ id }) });
const payload = { schemaVersion: 1, assumptions: { maxLtcPct: 0.75 } };

function jsonRequest(method: "POST" | "PATCH", body: Record<string, unknown> = {}) {
  return new Request("https://t1f.tools/api/admin/test", {
    method,
    headers: { "Content-Type": "application/json", "X-Role": "admin" },
    // Client-supplied role hints must never authorize a user session.
    body: JSON.stringify({ ...body, role: "admin", created_by_role: "admin" }),
  });
}

function uploadRequest() {
  const form = new FormData();
  form.set("file", new File(["%PDF-1.4\n% synthetic access-control test"], "test-policy.pdf", { type: "application/pdf" }));
  form.set("doc_type", "credit_policy");
  form.set("title", "Synthetic access-control test");
  form.set("version_label", "test-only");
  form.set("role", "admin");
  return new Request("https://t1f.tools/api/admin/documents/upload", { method: "POST", body: form });
}

const mutations = [
  { name: "create rule set", run: () => createRuleSet(jsonRequest("POST", { rule_type: "calculator_assumptions", version_label: "test-only", json_payload: payload })), service: ruleSets.insertRuleSet },
  { name: "edit rule set", run: () => editRuleSet(jsonRequest("PATCH", { version_label: "test-edited" }), context()), service: ruleSets.updateRuleSetDraft },
  { name: "publish rule set", run: () => publishRuleSet(jsonRequest("POST"), context()), service: ruleSets.publishRuleSet },
  { name: "archive rule set", run: () => archiveRuleSet(jsonRequest("POST"), context()), service: ruleSets.archiveRuleSet },
  { name: "rollback rule set", run: () => rollbackRuleSet(jsonRequest("POST"), context()), service: ruleSets.rollbackRuleSet },
  { name: "create binding", run: () => createBinding(jsonRequest("POST", { tool_key: "deal_engine", binding_type: "calculator_assumptions_rule_set", rule_set_id: id })), service: bindings.insertBindingDraft },
  { name: "publish binding", run: () => publishBinding(jsonRequest("POST"), context()), service: bindings.publishBinding },
  { name: "archive binding", run: () => archiveBinding(jsonRequest("POST"), context()), service: bindings.archiveBinding },
  { name: "upload policy document", run: () => uploadDocument(uploadRequest()), service: documents.insertDocument },
  { name: "publish policy document", run: () => publishDocument(jsonRequest("POST"), context()), service: documents.publishDocument },
  { name: "archive policy document", run: () => archiveDocument(jsonRequest("POST"), context()), service: documents.archiveDocument },
  { name: "rollback policy document", run: () => rollbackDocument(jsonRequest("POST"), context()), service: documents.rollbackToDocument },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ruleSets.getRuleSet).mockResolvedValue({ id, ruleType: "calculator_assumptions", status: "draft" } as Awaited<ReturnType<typeof ruleSets.getRuleSet>>);
  vi.mocked(ruleSets.insertRuleSet).mockResolvedValue({ id } as Awaited<ReturnType<typeof ruleSets.insertRuleSet>>);
  vi.mocked(ruleSets.updateRuleSetDraft).mockResolvedValue({ id } as Awaited<ReturnType<typeof ruleSets.updateRuleSetDraft>>);
  vi.mocked(bindings.insertBindingDraft).mockResolvedValue({ id } as Awaited<ReturnType<typeof bindings.insertBindingDraft>>);
  vi.mocked(documents.insertDocument).mockResolvedValue({ id, docType: "credit_policy" } as Awaited<ReturnType<typeof documents.insertDocument>>);
  vi.mocked(storage.putPdfBytes).mockResolvedValue({ storageKey: "test-only:not-written" });
  vi.mocked(extractPdfTextBestEffort).mockResolvedValue("Synthetic test policy text");
});

describe.each(mutations)("policy mutation access: $name", ({ run, service }) => {
  it.each(["user", null] as const)("rejects session role %s before any service or storage call", async (role) => {
    vi.mocked(getSessionPayload).mockResolvedValue(role ? { role, sid: "test-user-session" } : null);
    const response = await run();
    // Direct handlers fail closed with403; the public proxy returns401 for anonymous callers.
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    for (const mutation of mutations) expect(mutation.service).not.toHaveBeenCalled();
    expect(ruleSets.getRuleSet).not.toHaveBeenCalled();
    expect(storage.putPdfBytes).not.toHaveBeenCalled();
    expect(extractPdfTextBestEffort).not.toHaveBeenCalled();
    expect(enqueuePlatformEvent).not.toHaveBeenCalled();
  });

  it("allows an authenticated admin through the server-side guard", async () => {
    vi.mocked(getSessionPayload).mockResolvedValue({ role: "admin", sid: "test-admin-session" });
    const response = await run();
    expect(response.status).toBe(200);
    expect(service).toHaveBeenCalledTimes(1);
  });
});
