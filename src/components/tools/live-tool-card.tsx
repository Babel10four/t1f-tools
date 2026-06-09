import Link from "next/link";
import type { LiveToolDef } from "@/app/tools/tools-registry";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getToolStatus, TOOL_STATUS_LABEL } from "@/lib/tools/tool-shape";

const STATUS_TONE: Record<string, BadgeTone> = {
  ready: "ready",
  prototype: "prototype",
  placeholder: "placeholder",
};

/** Compact hub card: title + status badge, one-line outcome, single primary CTA. */
export function LiveToolCard({ tool }: { tool: LiveToolDef }) {
  const status = getToolStatus(tool.href);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {tool.label}
        </h3>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>
          {TOOL_STATUS_LABEL[status]}
        </Badge>
      </div>
      <p className="text-sm text-[var(--text-muted)]">{tool.description}</p>
      <div>
        <Link href={tool.href} className={buttonClassName("primary", "md", "w-fit")}>
          Open {tool.label}
        </Link>
      </div>
    </Card>
  );
}
