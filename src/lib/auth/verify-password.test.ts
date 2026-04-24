import { hash } from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRoleFromPassword } from "./verify-password";
import {
  SITE_PASSWORD_ADMIN_HASH_ENV,
  SITE_PASSWORD_ADMIN_OVERRIDE_ENV,
  SITE_PASSWORD_USER_HASH_ENV,
  SITE_PASSWORD_USER_OVERRIDE_ENV,
} from "./constants";

describe("resolveRoleFromPassword", () => {
  const prevUser = process.env[SITE_PASSWORD_USER_HASH_ENV];
  const prevAdmin = process.env[SITE_PASSWORD_ADMIN_HASH_ENV];
  const prevUserOv = process.env[SITE_PASSWORD_USER_OVERRIDE_ENV];
  const prevAdminOv = process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV];

  beforeEach(async () => {
    delete process.env[SITE_PASSWORD_USER_OVERRIDE_ENV];
    delete process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV];
    process.env[SITE_PASSWORD_USER_HASH_ENV] = await hash("user-secret", 4);
    process.env[SITE_PASSWORD_ADMIN_HASH_ENV] = await hash("admin-secret", 4);
  });

  afterEach(() => {
    process.env[SITE_PASSWORD_USER_HASH_ENV] = prevUser;
    process.env[SITE_PASSWORD_ADMIN_HASH_ENV] = prevAdmin;
    process.env[SITE_PASSWORD_USER_OVERRIDE_ENV] = prevUserOv;
    process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV] = prevAdminOv;
  });

  it("resolves admin when admin hash matches", async () => {
    expect(await resolveRoleFromPassword("admin-secret")).toBe("admin");
  });

  it("resolves user when user hash matches", async () => {
    expect(await resolveRoleFromPassword("user-secret")).toBe("user");
  });

  it("returns null for wrong password (generic failure)", async () => {
    expect(await resolveRoleFromPassword("nope")).toBeNull();
  });

  it("checks admin before user", async () => {
    process.env[SITE_PASSWORD_ADMIN_HASH_ENV] = await hash("same", 4);
    process.env[SITE_PASSWORD_USER_HASH_ENV] = await hash("same", 4);
    expect(await resolveRoleFromPassword("same")).toBe("admin");
  });

  it("uses admin override before user override; skips bcrypt when overrides exist", async () => {
    process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV] = "HouseOfCredit!";
    process.env[SITE_PASSWORD_USER_OVERRIDE_ENV] = "Leveraged$Gainz";
    expect(await resolveRoleFromPassword("HouseOfCredit!")).toBe("admin");
    expect(await resolveRoleFromPassword("Leveraged$Gainz")).toBe("user");
    expect(await resolveRoleFromPassword("admin-secret")).toBeNull();
    expect(await resolveRoleFromPassword("user-secret")).toBeNull();
  });

  it("checks admin override before user override when both set", async () => {
    process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV] = "same-ov";
    process.env[SITE_PASSWORD_USER_OVERRIDE_ENV] = "same-ov";
    expect(await resolveRoleFromPassword("same-ov")).toBe("admin");
  });
});
