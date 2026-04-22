/**
 * Admin-only primary nav (ADMIN-001). Downstream tickets attach real pages here.
 */
export const ADMIN_PRIMARY_NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/documents", label: "Documents" },
  { href: "/admin/rules", label: "Rule Sets & Rates" },
  { href: "/admin/bindings", label: "Tool bindings" },
  { href: "/admin/publish-history", label: "Publish History" },
] as const;
