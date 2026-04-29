import Link from "next/link";
import type { LiveToolDef } from "@/app/tools/tools-registry";

export function LiveToolCard({ tool }: { tool: LiveToolDef }) {
  return (
    <article className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {tool.label}
      </h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {tool.description}
      </p>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-500">
        Indicative workflow tool. Review policy/citations before final decisions.
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Link
          href={tool.href}
          className="inline-flex w-fit rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-hover)]"
        >
          Open {tool.label}
        </Link>
        <Link
          href={tool.href}
          className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          View details
        </Link>
      </div>
    </article>
  );
}
