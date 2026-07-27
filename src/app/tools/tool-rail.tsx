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
      className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-chrome)] px-2 py-2 lg:w-[216px] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible lg:border-b-0 lg:bg-[var(--brand-deep)] lg:px-3 lg:py-4"
      aria-label="Workbench tools"
    >
      {items.map((item) => {
        const active = isRailActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            aria-current={active ? "page" : undefined}
            className={[
              "group flex min-w-[88px] shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:min-w-0 lg:w-full",
              active
                ? "bg-[var(--brand-muted)] text-[var(--brand)] ring-1 ring-inset ring-[var(--border-subtle)] lg:bg-white/12 lg:text-white lg:ring-0"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] lg:text-[var(--sidebar-text)] lg:hover:bg-white/8 lg:hover:text-white",
              item.placeholder && !active
                ? "opacity-80 ring-1 ring-dashed ring-zinc-300/90 lg:ring-white/20"
                : "",
            ].join(" ")}
          >
            <span
              className={
                active
                  ? "text-[var(--brand)] lg:text-white"
                  : "text-zinc-500 group-hover:text-zinc-700 lg:text-[var(--sidebar-icon)] lg:group-hover:text-white"
              }
            >
              <ToolRailIcon id={item.icon} />
            </span>
            <span className="max-w-[7rem] truncate leading-tight lg:max-w-none">
              {item.shortLabel}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
