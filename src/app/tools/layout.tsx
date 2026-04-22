import Link from "next/link";
import type { ReactNode } from "react";
import { HUB_BUILT_BY_LINE, HUB_SYSTEM_NAME } from "@/lib/branding";
import { ToolsWorkbenchShell } from "./tools-workbench-shell";

export default function ToolsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
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
            {HUB_BUILT_BY_LINE}
          </p>
        </div>
        <Link
          href="/logout"
          className="shrink-0 text-sm font-medium text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
        >
          Log out
        </Link>
      </header>
      <ToolsWorkbenchShell>{children}</ToolsWorkbenchShell>
    </div>
  );
}
