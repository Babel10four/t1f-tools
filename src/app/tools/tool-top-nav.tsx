"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthRole } from "@/lib/auth/constants";
import { workflowStepsForRole } from "@/lib/tools/tool-visibility";

function isActive(pathname: string, href: string): boolean {
  if (href === "/tools") {
    return pathname === "/tools";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ToolTopNavProps = {
  role: AuthRole;
};

export function ToolTopNav({ role }: ToolTopNavProps) {
  const pathname = usePathname();
  const steps = workflowStepsForRole(role);

  if (steps.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Suggested workflow"
      className="border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-4 py-2 sm:px-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="mr-1 font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Workflow
        </span>
        {steps.map((step) => {
          const active = isActive(pathname, step.href);
          return (
            <Link
              key={step.href}
              href={step.href}
              className={[
                "rounded-full border px-3 py-1 font-medium transition-colors",
                active
                  ? "border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]"
                  : "border-zinc-200 bg-white text-[var(--text-muted)] hover:text-[var(--text-primary)]",
              ].join(" ")}
            >
              {step.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

