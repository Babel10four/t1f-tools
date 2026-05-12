import { describe, expect, it, vi } from "vitest";
import * as logEvent from "@/lib/analytics/log-event";
import * as verifyPassword from "@/lib/auth/verify-password";
import * as sessionToken from "@/lib/auth/session-token";
import { POST } from "./route";

describe("POST /api/auth/login", () => {
  it("logs session_login success with sessionOverride when credentials ok", async () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    vi.spyOn(verifyPassword, "resolveRoleFromPassword").mockResolvedValue("admin");
    vi.spyOn(sessionToken, "signSessionToken").mockResolvedValue("jwt-here");
    const spy = vi.spyOn(logEvent, "enqueuePlatformEvent").mockImplementation(() => {});

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "session_login",
        route: "/api/auth/login",
        status: "success",
        sessionOverride: expect.objectContaining({
          role: "admin",
        }) as { role: string; sessionId: string },
      }),
    );
    const call = spy.mock.calls[0]![0];
    expect(call.sessionOverride?.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("logs session_login error on invalid credentials", async () => {
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    vi.spyOn(verifyPassword, "resolveRoleFromPassword").mockResolvedValue(null);
    const spy = vi.spyOn(logEvent, "enqueuePlatformEvent").mockImplementation(() => {});

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "session_login",
        status: "error",
        metadata: { reason: "invalid_credentials" },
      }),
    );
  });
});
