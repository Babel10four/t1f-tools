import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET as GET_LIST } from "./route";
import { GET as GET_RESOLVE } from "./resolve/route";
import * as session from "@/lib/auth/session-server";
import * as resolveMod from "@/lib/bindings/resolve";

vi.mock("@/lib/auth/session-server");
vi.mock("@/lib/bindings/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings/service")>();
  return {
    ...actual,
    listToolBindings: vi.fn(),
  };
});
vi.mock("@/lib/bindings/resolve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/bindings/resolve")>();
  return { ...actual, resolveToolBinding: vi.fn() };
});

import * as service from "@/lib/bindings/service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/admin/tool-bindings", () => {
  it("returns 403 for non-admin", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue({
      role: "user",
      sid: "s",
    });
    const res = await GET_LIST(new Request("http://x"));
    expect(res.status).toBe(403);
  });

  it("returns bindings for admin", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue({
      role: "admin",
      sid: "s",
    });
    vi.mocked(service.listToolBindings).mockResolvedValue([]);
    const res = await GET_LIST(new Request("http://x"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/admin/tool-bindings/resolve", () => {
  it("returns missing when resolver reports no binding", async () => {
    vi.mocked(session.getSessionPayload).mockResolvedValue({
      role: "admin",
      sid: "s",
    });
    vi.mocked(resolveMod.resolveToolBinding).mockResolvedValue({
      state: "missing",
      reason: "no_published_binding",
    });
    const res = await GET_RESOLVE(
      new Request(
        "http://x?tool_key=credit_copilot&binding_type=credit_policy_document",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe("missing");
  });
});
