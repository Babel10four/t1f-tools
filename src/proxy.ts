import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { authCookieName, verifySessionToken } from "@/lib/auth/session-token";

const ADMIN_POST_LOGIN = "/admin/dashboard";
const CANONICAL_PRODUCTION_HOST = "t1f.tools";

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

function shouldUseCanonicalHost(request: NextRequest): boolean {
  return (
    process.env.VERCEL_ENV === "production" &&
    request.nextUrl.hostname.endsWith(".vercel.app")
  );
}

function noStore(response: NextResponse, role?: string): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  if (role) response.headers.set("X-T1F-Workspace", role);
  const build = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (build) response.headers.set("X-T1F-Build", build);
  return response;
}

export async function proxy(request: NextRequest) {
  if (shouldUseCanonicalHost(request)) {
    const canonical = request.nextUrl.clone();
    canonical.protocol = "https:";
    canonical.hostname = CANONICAL_PRODUCTION_HOST;
    canonical.port = "";
    return NextResponse.redirect(canonical, 307);
  }

  const { pathname } = request.nextUrl;

  const cookieName = authCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const session = await verifySessionToken(token);

  if (isLoginPath(pathname)) {
    // prevent loops, logins should only redirect after a valid session
    if (session?.role === "admin") return NextResponse.redirect(new URL(ADMIN_POST_LOGIN, request.url));
    if (session?.role === "user") return NextResponse.redirect(new URL("/tools", request.url));
    return noStore(NextResponse.next());
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

  return noStore(NextResponse.next(), session.role);
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
