import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /logout", () => {
  it("redirects to login without clearing the session cookie", () => {
    const res = GET(new Request("http://localhost/logout") as NextRequest);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
