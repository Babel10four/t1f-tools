import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AUTH_SECRET_ENV } from "@/lib/auth/constants";
import { resolveRoleFromPassword } from "@/lib/auth/verify-password";
import {
  authCookieName,
  sessionCookieOptions,
  signSessionToken,
} from "@/lib/auth/session-token";

export const runtime = "nodejs";

type LoginBody = {
  password?: unknown;
};

const DEFAULT_USER_PATH = "/tools";
const DEFAULT_ADMIN_PATH = "/admin/dashboard";

/**
 * POST /api/auth/login — verify shared password (bcrypt), set signed httpOnly JWT
 * with `role` + opaque `sid` (ACCESS-001A).
 */
export async function POST(request: Request) {
  if (!process.env[AUTH_SECRET_ENV] || process.env[AUTH_SECRET_ENV]!.length < 32) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const role = await resolveRoleFromPassword(password);
  if (!role) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signSessionToken(role, randomUUID());
  if (!token) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });
  }

  const defaultPath = role === "admin" ? DEFAULT_ADMIN_PATH : DEFAULT_USER_PATH;

  const res = NextResponse.json({ ok: true, defaultPath });
  res.cookies.set(authCookieName(), token, sessionCookieOptions());
  return res;
}
