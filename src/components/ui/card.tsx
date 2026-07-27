import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Token-aware surface card. Use instead of hardcoded
 * `bg-white dark:bg-zinc-950` so surfaces follow the theme tokens.
 */
export function Card({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-5 shadow-[0_1px_2px_rgba(17,34,24,0.04)]",
        className,
      )}
      {...rest}
    />
  );
}
