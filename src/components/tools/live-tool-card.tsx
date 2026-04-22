import Link from "next/link";
import type { LiveToolDef } from "@/app/tools/tools-registry";

export function LiveToolCard({ tool }: { tool: LiveToolDef }) {
  return (
    <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {tool.label}
      </h3>
      <p className="mt-2 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>
      <Link
        href={tool.href}
        className="mt-4 inline-flex w-fit rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {tool.ctaLabel}
      </Link>
    </article>
  );
}
