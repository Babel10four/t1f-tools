import Link from "next/link";
import type { ComingSoonToolDef } from "@/app/tools/tools-registry";

/** Visually distinct from shipped tools — muted, dashed, explicit “coming soon”. */
export function ComingSoonRow({ tool }: { tool: ComingSoonToolDef }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Coming soon
        </span>
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500">
          {tool.label}
        </span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Not a shipped workflow yet — placeholder route may exist for bookmarks only.
      </p>
      <Link
        href={tool.href}
        className="w-fit text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-400"
      >
        Open placeholder (preview)
      </Link>
    </div>
  );
}
