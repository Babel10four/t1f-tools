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
      <Link
        href={tool.href}
        className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        {tool.ctaLabel}
      </Link>
    </div>
  );
}
