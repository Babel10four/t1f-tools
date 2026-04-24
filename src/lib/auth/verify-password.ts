import { compare } from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import type { AuthRole } from "./constants";
import {
  SITE_PASSWORD_ADMIN_HASH_ENV,
  SITE_PASSWORD_ADMIN_OVERRIDE_ENV,
  SITE_PASSWORD_USER_HASH_ENV,
  SITE_PASSWORD_USER_OVERRIDE_ENV,
} from "./constants";

function timingSafeEqualUtf8(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) {
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Compare plaintext to optional env overrides first, then bcrypt hashes
 * only when no override vars are set. If any override is configured but
 * nothing matches, authentication fails (no hash fallback).
 */
export async function resolveRoleFromPassword(
  plaintext: string,
): Promise<AuthRole | null> {
  const adminOverride = process.env[SITE_PASSWORD_ADMIN_OVERRIDE_ENV];
  const userOverride = process.env[SITE_PASSWORD_USER_OVERRIDE_ENV];

  const hasAdminOverride =
    adminOverride !== undefined && adminOverride.length > 0;
  const hasUserOverride =
    userOverride !== undefined && userOverride.length > 0;
  const anyOverrideConfigured = hasAdminOverride || hasUserOverride;

  if (hasAdminOverride) {
    if (timingSafeEqualUtf8(plaintext, adminOverride)) {
      return "admin";
    }
  }

  if (hasUserOverride) {
    if (timingSafeEqualUtf8(plaintext, userOverride)) {
      return "user";
    }
  }

  if (anyOverrideConfigured) {
    return null;
  }

  const adminHash = process.env[SITE_PASSWORD_ADMIN_HASH_ENV];
  const userHash = process.env[SITE_PASSWORD_USER_HASH_ENV];

  if (adminHash) {
    try {
      if (await compare(plaintext, adminHash)) {
        return "admin";
      }
    } catch {
      /* treat as no match */
    }
  }

  if (userHash) {
    try {
      if (await compare(plaintext, userHash)) {
        return "user";
      }
    } catch {
      /* treat as no match */
    }
  }

  return null;
}
