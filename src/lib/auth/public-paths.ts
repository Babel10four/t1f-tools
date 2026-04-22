/**
 * Helpers describing auth bootstrap routes (not covered by the ACCESS-001A matcher).
 * Middleware uses a positive matcher list instead of calling this.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") {
    return true;
  }
  if (pathname === "/logout") {
    return true;
  }
  if (pathname === "/api/auth/login" || pathname.startsWith("/api/auth/login/")) {
    return true;
  }
  if (pathname === "/api/auth/logout" || pathname.startsWith("/api/auth/logout/")) {
    return true;
  }
  return false;
}
