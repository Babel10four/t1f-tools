import { describe, expect, it, vi, beforeEach } from "vitest";
import { runCreditCopilotAsk } from "@/lib/credit-copilot/runAsk";
import * as logEvent from "@/lib/analytics/log-event";
import { POST } from "./route";

vi.mock("@/lib/credit-copilot/runAsk", () => ({
  MAX_QUESTION_LEN: 4000,
  runCreditCopilotAsk: vi.fn(),
}));

describe("POST /api/credit-copilot/ask", () => {
  beforeEach(() => {
    vi.mocked(runCreditCopilotAsk).mockReset();
    vi.spyOn(logEvent, "enqueuePlatformEvent").mockImplementation(() => {});
  });

  it("logs analytics without raw question text", async () => {
    vi.mocked(runCreditCopilotAsk).mockResolvedValue({
      status: "answered",
      answer: "ok",
      citations: [{ label: "a", excerpt: "e", chunkId: "chunk-0" }],
      sourceDocument: {
        id: "d1",
        title: "P",
        versionLabel: "v1",
        publishedAt: null,
      },
      warnings: [],
      disclaimer: "d",
    });
    const req = new Request("http://localhost/api/credit-copilot/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "  super secret borrower question text  ",
      }),
    });
    await POST(req);
    expect(logEvent.enqueuePlatformEvent).toHaveBeenCalled();
    const call = vi.mocked(logEvent.enqueuePlatformEvent).mock.calls[0]![0];
    expect(call.eventType).toBe("credit_copilot_question");
    expect(call.toolKey).toBe("credit_copilot");
    expect(call.route).toBe("/api/credit-copilot/ask");
    expect(JSON.stringify(call.metadata)).not.toMatch(/super secret/);
    expect(call.metadata?.questionLength).toBeGreaterThan(10);
  });
});
