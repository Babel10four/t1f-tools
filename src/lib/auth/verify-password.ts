import { compare } from "bcryptjs";
import type { AuthRole } from "./constants";
import {
  SITE_PASSWORD_ADMIN_HASH_ENV,
  SITE_PASSWORD_USER_HASH_ENV,
} from "./constants";

/**
 * Compare plaintext to env bcrypt hashes. Admin checked first if both exist.
 * Generic failures — no indication which hash almost matched.
 */
export async function resolveRoleFromPassword(
  plaintext: string,
): Promise<AuthRole | null> {
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
