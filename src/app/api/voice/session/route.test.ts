import { describe, expect, it, vi, beforeEach } from "vitest";
import * as logEvent from "@/lib/analytics/log-event";
import { POST } from "./route";

describe("POST /api/voice/session (TICKET-009A)", () => {
  beforeEach(() => {
    vi.spyOn(logEvent, "enqueuePlatformEvent").mockImplementation(() => {});
  });

  it("logs voice_session_run + voice_operator, not Credit Copilot taxonomy", async () => {
    const req = new Request("http://localhost/api/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await POST(req);
    expect(logEvent.enqueuePlatformEvent).toHaveBeenCalled();
    const call = vi.mocked(logEvent.enqueuePlatformEvent).mock.calls[0]![0];
    expect(call.eventType).toBe("voice_session_run");
    expect(call.toolKey).toBe("voice_operator");
    expect(call.route).toBe("/api/voice/session");
    expect(call.eventType).not.toBe("credit_copilot_question");
    expect(call.toolKey).not.toBe("credit_copilot");
  });
});
