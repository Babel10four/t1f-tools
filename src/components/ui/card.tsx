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
        "rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-5 shadow-sm",
        className,
      )}
      {...rest}
    />
  );
}
