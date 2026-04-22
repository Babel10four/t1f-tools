import type { AuthRole } from "./constants";

export type AccessDecision =
  | { action: "allow" }
  | { action: "need_login" }
  | { action: "forbidden_admin" };

/**
 * Admin-only URLs: `/admin` subtree and `/api/admin` subtree.
 * Does not match `/administration` or other accidental `/admin` prefixes.
 */
export function isAdminOnlyPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

/**
 * Pure routing decision for middleware/tests — call only for protected pathnames.
 */
export function decideAccess(
  pathname: string,
  role: AuthRole | null,
): AccessDecision {
  if (!role) {
    return { action: "need_login" };
  }
  if (isAdminOnlyPath(pathname) && role !== "admin") {
    return { action: "forbidden_admin" };
  }
  return { action: "allow" };
}
