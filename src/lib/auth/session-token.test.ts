import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_SECRET_ENV } from "./constants";
import {
  signSessionToken,
  verifySessionToken,
} from "./session-token";

describe("session-token", () => {
  const prev = process.env[AUTH_SECRET_ENV];

  beforeEach(() => {
    process.env[AUTH_SECRET_ENV] = "01234567890123456789012345678901";
  });

  afterEach(() => {
    process.env[AUTH_SECRET_ENV] = prev;
  });

  it("roundtrips user and admin roles with sid", async () => {
    const u = await signSessionToken("user", "sid-user-1");
    const a = await signSessionToken("admin", "sid-admin-1");
    expect(u).toBeTruthy();
    expect(a).toBeTruthy();
    expect(await verifySessionToken(u!)).toEqual({
      role: "user",
      sid: "sid-user-1",
    });
    expect(await verifySessionToken(a!)).toEqual({
      role: "admin",
      sid: "sid-admin-1",
    });
  });

  it("rejects tampered token", async () => {
    const t = await signSessionToken("user", "sid-x");
    expect(await verifySessionToken(`${t!}x`)).toBeNull();
  });

  it("rejects token without sid in payload", async () => {
    const secret = new TextEncoder().encode(
      process.env[AUTH_SECRET_ENV] ?? "",
    );
    const { SignJWT } = await import("jose");
    const bad = await new SignJWT({ role: "user" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);
    expect(await verifySessionToken(bad)).toBeNull();
  });

  it("returns null for missing secret", async () => {
    process.env[AUTH_SECRET_ENV] = "";
    expect(await signSessionToken("user", "sid")).toBeNull();
    expect(await verifySessionToken("any")).toBeNull();
  });

  it("rejects empty sid at sign", async () => {
    expect(await signSessionToken("user", "")).toBeNull();
  });
});
