import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

describe("isPublicPath", () => {
  it("allows login and logout and auth API", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/logout")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/logout")).toBe(true);
  });

  it("does not allow protected areas", () => {
    expect(isPublicPath("/tools")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/api/deal/analyze")).toBe(false);
    expect(isPublicPath("/api/property/rural")).toBe(false);
    expect(isPublicPath("/api/credit-copilot/ask")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});
