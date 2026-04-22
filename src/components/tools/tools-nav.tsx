import Link from "next/link";
import { TOOLS_NAV_SECTIONS } from "@/app/tools/tools-registry";

/**
 * Shared hub / workbench navigation (TICKET-006, BRAND-001) — reused by `/tools` and `/admin` shells.
 */
export function ToolsNav() {
  return (
    <nav className="flex flex-col gap-6" aria-label="Tool navigation">
      {TOOLS_NAV_SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
            {section.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {section.links.map((item) => (
              <Link
                key={`${section.id}-${item.href}`}
                href={item.href}
                className={navLinkClassName(section.id, item.isPlaceholder)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function navLinkClassName(
  sectionId: (typeof TOOLS_NAV_SECTIONS)[number]["id"],
  isPlaceholder: boolean,
): string {
  if (isPlaceholder) {
    return "rounded-full border border-dashed border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400 dark:hover:bg-zinc-900";
  }
  if (sectionId === "advanced") {
    return "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800";
  }
  return "rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";
}
