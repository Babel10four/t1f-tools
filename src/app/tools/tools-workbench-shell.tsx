"use client";

import type { ReactNode } from "react";
import type { AuthRole } from "@/lib/auth/constants";
import { ToolRail } from "./tool-rail";
import { ToolRoleProvider } from "./tool-role-context";

type Props = {
  children: ReactNode;
  role: AuthRole;
};

export function ToolsWorkbenchShell({ children, role }: Props) {
  return (
    <ToolRoleProvider role={role}>
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface-page)]">
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <ToolRail role={role} />
          <div className="flex min-h-0 min-w-0 flex-1">
            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--surface-page)]">
              <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </ToolRoleProvider>
  );
}
