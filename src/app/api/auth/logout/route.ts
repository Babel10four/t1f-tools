import { NextResponse } from "next/server";
import { authCookieName, clearedSessionCookieOptions } from "@/lib/auth/session-token";

/**
 * POST /api/auth/logout — clear session cookie (works with or without prior session).
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName(), "", clearedSessionCookieOptions());
  return res;
}
