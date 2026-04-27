"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AuthRole } from "@/lib/auth/constants";
import { filterToolRailItems } from "@/lib/tools/tool-visibility";
import { ToolRailIcon } from "./tool-rail-icons";

function isRailActive(pathname: string, href: string): boolean {
  if (href === "/tools") {
    return pathname === "/tools";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type ToolRailProps = {
  role: AuthRole;
};

export function ToolRail({ role }: ToolRailProps) {
  const pathname = usePathname();
  const items = filterToolRailItems(role);

  return (
    <nav
      className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-2 py-2 lg:w-[72px] lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-visible lg:border-b-0 lg:border-r lg:px-1.5 lg:py-3"
      aria-label="Workbench tools"
    >
      {items.map((item) => {
        const active = isRailActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            className={[
              "group flex min-w-[52px] shrink-0 flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[10px] font-medium transition-colors lg:min-w-0 lg:w-full lg:px-2",
              active
                ? "border-b-2 border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)] lg:border-b-0 lg:border-l-[3px] lg:border-t-0 lg:border-r-0 lg:border-[var(--brand)]"
                : "border-b-2 border-transparent text-[var(--text-muted)] hover:bg-zinc-50 hover:text-[var(--text-primary)] lg:border-l-[3px] lg:border-transparent",
              item.placeholder && !active
                ? "opacity-80 ring-1 ring-dashed ring-zinc-300/90"
                : "",
            ].join(" ")}
          >
            <span
              className={
                active ? "text-[var(--brand)]" : "text-zinc-500 group-hover:text-zinc-700"
              }
            >
              <ToolRailIcon id={item.icon} />
            </span>
            <span className="max-w-[4.5rem] truncate text-center leading-tight lg:max-w-none">
              {item.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
