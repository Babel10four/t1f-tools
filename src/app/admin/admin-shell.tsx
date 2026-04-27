import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ToolsNav } from "@/components/tools/tools-nav";
import { ADMIN_PRIMARY_NAV } from "./admin-nav";

type AdminShellProps = {
  children: ReactNode;
};

/**
 * Admin layout chrome — kept in one place so CONTENT/CONFIG/ANALYTICS tickets plug in without re-plumbing.
 */
export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col border-l-4 border-amber-500 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/25">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <header className="border-b border-amber-200/80 pb-6 dark:border-amber-900/50">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white dark:bg-amber-700">
                  Admin
                </span>
                <Link
                  href="/admin/dashboard"
                  className="text-xl font-semibold tracking-tight text-zinc-900 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
                >
                  Operations
                </Link>
              </div>
              <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                Elevated area for uploads, configuration, and publishing —{" "}
                <Link
                  href="/tools"
                  className="font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
                >
                  Tool Hub
                </Link>{" "}
                and all rep tools stay available below.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                href="/tools"
                className="text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Tool Hub
              </Link>
              <LogoutButton
                className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Log out
              </LogoutButton>
            </div>
          </div>

          <nav
            className="mt-6 flex flex-wrap gap-2"
            aria-label="Admin primary navigation"
            data-testid="admin-primary-nav"
          >
            {ADMIN_PRIMARY_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-100 dark:hover:bg-amber-950/40"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <section
            className="mt-8 rounded-lg border border-zinc-200 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/80"
            aria-label="Deal workbench navigation"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Deal workbench (same as /tools)
            </p>
            <div className="mt-3">
              <ToolsNav role="admin" />
            </div>
          </section>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
