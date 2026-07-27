import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HUB_SYSTEM_NAME } from "@/lib/branding";
import { decideAccess } from "@/lib/auth/access";
import { getSessionPayload } from "@/lib/auth/session-server";
import { ToolTopNav } from "./tool-top-nav";
import { ToolsWorkbenchShell } from "./tools-workbench-shell";

export default async function ToolsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getSessionPayload();

  // Align behavior with middleware; also handles forbidden-admin.
  const decision = decideAccess("/tools", session?.role ?? null);
  if (decision.action === "need_login") {
    redirect(`/login?next=${encodeURIComponent("/tools")}`);
  }
  if (decision.action === "forbidden_admin") {
    redirect("/tools");
  }
  const role = session?.role ?? "user";
  const build =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    "local";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-4 py-3">
        <div className="min-w-0">
          <Link
            href="/tools"
            className="text-base font-semibold tracking-tight text-[var(--text-primary)] hover:opacity-90"
          >
            {HUB_SYSTEM_NAME}
          </Link>
          <p className="truncate text-xs font-medium text-[var(--text-muted)]">
            {role === "admin" ? "Admin workspace" : "Rep workspace"} · build{" "}
            <span className="font-mono">{build}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {role === "admin" ? (
            <Link
              href="/admin/dashboard"
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Admin reporting
            </Link>
          ) : null}
          <LogoutButton
            className="text-sm font-medium text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
          >
            Log out
          </LogoutButton>
        </div>
      </header>
      <ToolTopNav role={role} />
      <ToolsWorkbenchShell role={role}>
        {children}
      </ToolsWorkbenchShell>
    </div>
  );
}
