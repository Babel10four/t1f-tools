import Link from "next/link";
import type { AdvancedToolDef } from "@/app/tools/tools-registry";

/** Secondary / advanced entry — not grouped with live rep tools. */
export function AdvancedToolRow({ tool }: { tool: AdvancedToolDef }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        {tool.label}
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Link
          href={tool.href}
          className="inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          {tool.ctaLabel}
        </Link>
        <Link
          href={tool.href}
          className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
        >
          View JSON harness
        </Link>
      </div>
    </div>
  );
}
