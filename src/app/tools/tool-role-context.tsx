"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthRole } from "@/lib/auth/constants";

const ToolRoleContext = createContext<AuthRole | null>(null);

export function ToolRoleProvider({
  role,
  children,
}: {
  role: AuthRole;
  children: ReactNode;
}) {
  return (
    <ToolRoleContext.Provider value={role}>{children}</ToolRoleContext.Provider>
  );
}

/**
 * Role of the signed-in user, for client tool pages that need to role-filter UI (e.g. hiding
 * admin-only "Next" handoffs). Falls back to `"user"` (least privilege) outside a provider so a
 * stray render never leaks admin-only links.
 */
export function useToolRole(): AuthRole {
  return useContext(ToolRoleContext) ?? "user";
}
