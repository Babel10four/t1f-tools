import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authCookieName, clearedSessionCookieOptions } from "@/lib/auth/session-token";

/**
 * GET /logout — clear cookie and redirect to login (ACCESS-001).
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.set(authCookieName(), "", clearedSessionCookieOptions());
  return res;
}
