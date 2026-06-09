import Link from "next/link";
import type { ReactNode } from "react";
import {
  ADVANCED_TOOLS,
  CREDIT_COPILOT_TOOL,
  LIVE_INTEL_TOOLS,
  LIVE_TOOLS,
  RESOURCES_TOOLS,
} from "@/app/tools/tools-registry";
import { useToolRole } from "@/app/tools/tool-role-context";
import { hrefVisibleToRole } from "@/lib/tools/tool-visibility";
import {
  getToolShape,
  getToolStatus,
  TOOL_STATUS_LABEL,
} from "@/lib/tools/tool-shape";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

const TOOL_TITLES: Record<string, string> = Object.fromEntries(
  [
    ...LIVE_TOOLS,
    ...LIVE_INTEL_TOOLS,
    CREDIT_COPILOT_TOOL,
    ...RESOURCES_TOOLS,
    ...ADVANCED_TOOLS,
  ].map((t) => [t.href, t.label]),
);

const STATUS_TONE: Record<string, BadgeTone> = {
  ready: "ready",
  prototype: "prototype",
  placeholder: "placeholder",
};

type ToolPageHeaderProps = {
  /** Tool route — keys into the shape/status/title maps. */
  href: string;
  /** Right-aligned action slot (e.g. "Clear saved deal inputs"). */
  actions?: ReactNode;
  /** Disclosure / disclaimer slot rendered under the shape grid. */
  disclosure?: ReactNode;
  /** Optional title override when a page label differs from the registry. */
  title?: string;
  className?: string;
};

/**
 * Standardized tool-page header: title + status badge, one-sentence Goal, and a compact
 * Inputs / Output / Next grid pulled from {@link TOOL_SHAPES}. "Next" handoffs are role-filtered so
 * users never see links to admin-only tools.
 */
export function ToolPageHeader({
  href,
  actions,
  disclosure,
  title,
  className,
}: ToolPageHeaderProps) {
  const role = useToolRole();
  const shape = getToolShape(href);
  const status = getToolStatus(href);
  const heading = title ?? TOOL_TITLES[href] ?? href;
  const nextLinks = (shape?.next ?? []).filter((link) =>
    hrefVisibleToRole(link.href, role),
  );

  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {heading}
            </h1>
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>
              {TOOL_STATUS_LABEL[status]}
            </Badge>
          </div>
          {shape ? (
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">
              {shape.goal}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {shape ? (
        <dl className="grid gap-px overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--border-subtle)] text-sm sm:grid-cols-3">
          <div className="bg-[var(--surface-chrome)] p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Inputs
            </dt>
            <dd className="mt-1.5">
              <ul className="space-y-1 text-[var(--text-primary)]">
                {shape.inputs.map((input) => (
                  <li key={input} className="flex gap-1.5">
                    <span aria-hidden className="text-[var(--text-muted)]">
                      •
                    </span>
                    <span>{input}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="bg-[var(--surface-chrome)] p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Output
            </dt>
            <dd className="mt-1.5 text-[var(--text-primary)]">{shape.output}</dd>
          </div>
          <div className="bg-[var(--surface-chrome)] p-4">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Next
            </dt>
            <dd className="mt-1.5">
              {nextLinks.length > 0 ? (
                <ul className="space-y-1">
                  {nextLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
                      >
                        {link.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[var(--text-muted)]">
                  Standalone — no handoff needed.
                </span>
              )}
            </dd>
          </div>
        </dl>
      ) : null}

      {disclosure ? <div>{disclosure}</div> : null}
    </header>
  );
}
