import Link from "next/link";
import type { LiveToolDef } from "@/app/tools/tools-registry";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getToolStatus, TOOL_STATUS_LABEL } from "@/lib/tools/tool-shape";
import { cn } from "@/lib/utils/cn";

const STATUS_TONE: Record<string, BadgeTone> = {
  ready: "ready",
  prototype: "prototype",
  placeholder: "placeholder",
};

/** Compact hub card: title + status badge, one-line outcome, single primary CTA. */
export function LiveToolCard({
  tool,
  className,
}: {
  tool: LiveToolDef;
  className?: string;
}) {
  const status = getToolStatus(tool.href);

  return (
    <Card
      className={cn(
        "group flex h-full flex-col gap-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
          {tool.label}
        </h3>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>
          {TOOL_STATUS_LABEL[status]}
        </Badge>
      </div>
      <p className="flex-1 text-sm leading-6 text-[var(--text-muted)]">
        {tool.description}
      </p>
      <div className="border-t border-[var(--border-subtle)] pt-3">
        <Link
          href={tool.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] underline-offset-4 hover:underline"
        >
          Open {tool.label}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </Card>
  );
}
