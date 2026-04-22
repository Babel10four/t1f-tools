import { describe, expect, it } from "vitest";
import { decideAccess, isAdminOnlyPath } from "./access";

describe("isAdminOnlyPath", () => {
  it("matches /admin subtree and /api/admin only", () => {
    expect(isAdminOnlyPath("/admin")).toBe(true);
    expect(isAdminOnlyPath("/admin/dashboard")).toBe(true);
    expect(isAdminOnlyPath("/admin/bindings")).toBe(true);
    expect(isAdminOnlyPath("/api/admin")).toBe(true);
    expect(isAdminOnlyPath("/api/admin/anything")).toBe(true);
    expect(isAdminOnlyPath("/api/admin/tool-bindings/resolve")).toBe(true);
  });

  it("does not match /administration or arbitrary /admin prefix strings", () => {
    expect(isAdminOnlyPath("/administration")).toBe(false);
    expect(isAdminOnlyPath("/adminfoo")).toBe(false);
  });

  it("does not match non-admin tool routes", () => {
    expect(isAdminOnlyPath("/tools")).toBe(false);
    expect(isAdminOnlyPath("/api/deal/analyze")).toBe(false);
  });
});

describe("decideAccess", () => {
  it("allows authenticated user for /tools paths", () => {
    expect(decideAccess("/tools", "user")).toEqual({ action: "allow" });
    expect(decideAccess("/tools/foo", "user")).toEqual({ action: "allow" });
  });

  it("allows admin for /tools and /admin", () => {
    expect(decideAccess("/tools", "admin")).toEqual({ action: "allow" });
    expect(decideAccess("/admin/dashboard", "admin")).toEqual({
      action: "allow",
    });
    expect(decideAccess("/api/admin/reports", "admin")).toEqual({
      action: "allow",
    });
  });

  it("denies unauthenticated", () => {
    expect(decideAccess("/tools", null)).toEqual({ action: "need_login" });
    expect(decideAccess("/api/deal/analyze", null)).toEqual({
      action: "need_login",
    });
    expect(decideAccess("/api/admin/x", null)).toEqual({
      action: "need_login",
    });
  });

  it("denies user role for /admin and /api/admin", () => {
    expect(decideAccess("/admin", "user")).toEqual({
      action: "forbidden_admin",
    });
    expect(decideAccess("/admin/dashboard", "user")).toEqual({
      action: "forbidden_admin",
    });
    expect(decideAccess("/api/admin/health", "user")).toEqual({
      action: "forbidden_admin",
    });
  });
});
