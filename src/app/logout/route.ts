import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * GET /logout is intentionally harmless.
 * Actual logout must use POST /api/auth/logout.
 */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
