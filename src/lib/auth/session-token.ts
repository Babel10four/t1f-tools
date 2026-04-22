import { SignJWT, jwtVerify } from "jose";
import {
  AUTH_COOKIE_DOMAIN_ENV,
  AUTH_COOKIE_NAME,
  AUTH_SECRET_ENV,
  type AuthRole,
} from "./constants";

const JWT_ALG = "HS256";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7d — keep in sync with cookie maxAge

export type SessionPayload = {
  role: AuthRole;
  /** Opaque session id for analytics — not a user identity. */
  sid: string;
};

function getSecretKey(): Uint8Array | null {
  const raw = process.env[AUTH_SECRET_ENV];
  if (!raw || raw.length < 32) {
    return null;
  }
  return new TextEncoder().encode(raw);
}

function isRole(v: unknown): v is AuthRole {
  return v === "user" || v === "admin";
}

function isNonEmptySid(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export async function signSessionToken(
  role: AuthRole,
  sid: string,
): Promise<string | null> {
  const secret = getSecretKey();
  if (!secret || !isNonEmptySid(sid)) {
    return null;
  }
  return new SignJWT({ role, sid })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Verify JWT from cookie; Edge-safe (jose only — no bcrypt).
 */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }
  const secret = getSecretKey();
  if (!secret) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    const p = payload as { role?: unknown; sid?: unknown };
    if (!isRole(p.role) || !isNonEmptySid(p.sid)) {
      return null;
    }
    return { role: p.role, sid: p.sid };
  } catch {
    return null;
  }
}

export function authCookieName(): typeof AUTH_COOKIE_NAME {
  return AUTH_COOKIE_NAME;
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env[AUTH_COOKIE_DOMAIN_ENV];
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    ...(domain ? { domain } : {}),
  };
}

export function clearedSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}
