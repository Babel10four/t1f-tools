import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "ready" | "prototype" | "placeholder" | "neutral";

const TONES: Record<BadgeTone, string> = {
  ready:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  prototype:
    "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  placeholder:
    "border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400",
  neutral: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
