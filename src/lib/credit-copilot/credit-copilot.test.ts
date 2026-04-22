import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentRow } from "@/db/schema";
import * as resolveMod from "@/lib/bindings/resolve";
import { runCreditCopilotAsk } from "./runAsk";

vi.mock("@/lib/bindings/resolve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings/resolve")>();
  return {
    ...actual,
    resolveToolBinding: vi.fn(),
  };
});

describe("runCreditCopilotAsk (TICKET-009)", () => {
  beforeEach(() => {
    vi.mocked(resolveMod.resolveToolBinding).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function publishedCreditDoc(
    extractedText: string | null,
  ): DocumentRow {
    return {
      id: "00000000-0000-4000-8000-000000000001",
      seriesId: "00000000-0000-4000-8000-000000000002",
      docType: "credit_policy",
      title: "Credit Policy",
      versionLabel: "v-test",
      effectiveDate: null,
      status: "published",
      storageKey: "blob/key.pdf",
      contentType: "application/pdf",
      byteSize: 100,
      originalFilename: null,
      extractedText,
      notes: null,
      createdAt: new Date(),
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      archivedAt: null,
      createdByRole: null,
    };
  }

  it("returns policy_unavailable when binding is missing", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "missing",
      reason: "no_published_binding",
    });
    const out = await runCreditCopilotAsk({
      question: "What is the LTV limit?",
    });
    expect(out.status).toBe("policy_unavailable");
    expect(out.answer).toMatch(/No published credit policy/i);
    expect(out.citations).toHaveLength(0);
  });

  it("returns insufficient_policy_context when extracted_text is too short", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "resolved",
      bindingId: "b1",
      kind: "document",
      document: publishedCreditDoc("short"),
    });
    const out = await runCreditCopilotAsk({ question: "What is LTV?" });
    expect(out.status).toBe("insufficient_policy_context");
  });

  it("refuses decision-style questions", async () => {
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "resolved",
      bindingId: "b1",
      kind: "document",
      document: publishedCreditDoc("x".repeat(200)),
    });
    const out = await runCreditCopilotAsk({
      question: "Will you approve this loan?",
    });
    expect(out.status).toBe("refused_sensitive_or_decision_request");
  });

  it("returns insufficient_policy_context when retrieval is weak", async () => {
    const body = [
      "This paragraph discusses widgets and unrelated topics only.",
      "More text about gardening and weather patterns in the region.",
    ].join("\n\n");
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "resolved",
      bindingId: "b1",
      kind: "document",
      document: publishedCreditDoc(body.repeat(3)),
    });
    const out = await runCreditCopilotAsk({
      question: "quantum physics borrowing norms",
    });
    expect(out.status).toBe("insufficient_policy_context");
  });

  it("answers from chunks with extractive path when OPENAI_API_KEY is unset", async () => {
    const policy = [
      "Loan to value LTV maximum for bridge purchases is seventy five percent.",
      "Borrowers must provide two years tax returns when self employed.",
    ].join("\n\n");
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "resolved",
      bindingId: "b1",
      kind: "document",
      document: publishedCreditDoc(policy.repeat(2)),
    });
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "";
    const out = await runCreditCopilotAsk({
      question: "What is the LTV maximum for bridge purchases?",
    });
    if (prev !== undefined) {
      process.env.OPENAI_API_KEY = prev;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    expect(out.status).toBe("answered");
    expect(out.answer).toMatch(/LTV|ltv|seventy/i);
    expect(out.citations.length).toBeGreaterThan(0);
    expect(out.sourceDocument?.title).toBe("Credit Policy");
  });
});
