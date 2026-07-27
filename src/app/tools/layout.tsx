import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HUB_SYSTEM_NAME } from "@/lib/branding";
import { decideAccess } from "@/lib/auth/access";
import { getSessionPayload } from "@/lib/auth/session-server";
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
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-4 py-2.5 shadow-[0_1px_0_rgba(19,46,33,0.03)] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/tools"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--brand-hover)]"
            aria-label={`${HUB_SYSTEM_NAME} home`}
          >
            T
          </Link>
          <div className="min-w-0">
            <Link
              href="/tools"
              className="text-base font-semibold tracking-tight text-[var(--text-primary)] hover:text-[var(--brand)]"
            >
              {HUB_SYSTEM_NAME}
            </Link>
            <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">
              {role === "admin" ? "Admin workspace" : "Rep workspace"} · build{" "}
              <span className="font-mono">{build}</span>
            </p>
          </div>
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
      <ToolsWorkbenchShell role={role}>
        {children}
      </ToolsWorkbenchShell>
    </div>
  );
}
