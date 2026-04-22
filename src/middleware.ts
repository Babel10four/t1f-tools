import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { authCookieName, verifySessionToken } from "@/lib/auth/session-token";

const ADMIN_POST_LOGIN = "/admin/dashboard";

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const session: any = { role: "user" }; await verifySessionToken(
    request.cookies.get(authCookieName())?.value,
  );

  if (isLoginPath(pathname)) {
    if (session?.role === "admin") {
      return NextResponse.redirect(new URL(ADMIN_POST_LOGIN, request.url));
    }
    if (session?.role === "user") {
      return NextResponse.redirect(new URL("/tools", request.url));
    }
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  if (!session) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(login);
  }

  const decision = decideAccess(pathname, session.role);

  if (decision.action === "need_login") {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(login);
  }

  if (decision.action === "forbidden_admin") {
    if (isApi) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/tools", request.url));
  }

  return NextResponse.next();
}

/** Only these segments are auth-gated (ACCESS-001A). Other routes stay public. */
export const config = {
  matcher: [
    "/login",
    "/login/:path*",
    "/tools",
    "/tools/:path*",
    "/admin",
    "/admin/:path*",
    "/api/deal",
    "/api/deal/:path*",
    "/api/property",
    "/api/property/:path*",
    "/api/credit-copilot",
    "/api/credit-copilot/:path*",
    "/api/admin",
    "/api/admin/:path*",
  ],
};
