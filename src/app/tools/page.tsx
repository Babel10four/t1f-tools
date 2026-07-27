import type { Metadata } from "next";
import Link from "next/link";
import { AdvancedToolRow } from "@/components/tools/advanced-tool-row";
import { LiveToolCard } from "@/components/tools/live-tool-card";
import { WorkflowsBlock } from "@/components/tools/workflows-block";
import { buttonClassName } from "@/components/ui/button";
import { getSessionPayload } from "@/lib/auth/session-server";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import {
  filterHubPageModel,
  hubHeroDescriptionForRole,
  hrefVisibleToRole,
  primaryCtaHrefForRole,
  primaryCtaLabelForRole,
} from "@/lib/tools/tool-visibility";
import { workflowsForRole } from "@/lib/tools/workflows";
import { CREDIT_COPILOT_TOOL } from "./tools-registry";

export const metadata: Metadata = {
  title: "Tool Hub",
  description: PRODUCT_TAGLINE,
};

export default async function ToolsHubPage() {
  const session = await getSessionPayload();
  const role = session?.role ?? "user";
  const hub = filterHubPageModel(role);
  const primaryHref = primaryCtaHrefForRole(role);
  const primaryLabel = primaryCtaLabelForRole(role);
  const workflows = workflowsForRole(role);

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
          {role === "admin" ? "Admin workspace" : "Rep workspace"}
        </p>
        <div className="flex flex-col gap-1.5">
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Get the next deal step done
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--text-muted)]">
            {hubHeroDescriptionForRole(role)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={primaryHref} className={buttonClassName("primary", "md")}>
            Start with {primaryLabel}
          </Link>
          {hrefVisibleToRole("/tools/deal-analyzer", role) ? (
            <Link
              href="/tools/deal-analyzer"
              className="text-sm font-medium text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text-primary)]"
            >
              View JSON harness
            </Link>
          ) : null}
        </div>
      </section>

      <WorkflowsBlock workflows={workflows} />

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Build and quote
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Shipped deal tools for structuring, terms, cash to close, and pricing.
        </p>
        <div className="mt-6 flex max-w-3xl flex-col gap-4">
          {hub.executionSequence.map((item) => (
            <LiveToolCard key={item.tool.href} tool={item.tool} />
          ))}
        </div>
      </section>

      {hub.liveIntelTools.length > 0 || hub.resourcesTools.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Research and follow up
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Build context on the borrower or property, then move quickly with a usable draft.
          </p>
          <div className="mt-6 flex max-w-3xl flex-col gap-4">
            {[...hub.liveIntelTools, ...hub.resourcesTools].map((tool) => (
              <LiveToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Policy support
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Policy Q&A — grounded in published credit policy text (not a credit pull).
        </p>
        <div className="mt-4 flex max-w-3xl flex-col gap-4">
          <LiveToolCard tool={CREDIT_COPILOT_TOOL} />
        </div>
      </section>

      {hub.advancedTools.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Advanced / Internal
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Engineer-oriented and contract-check tools — not primary rep workflows.
          </p>
          <div className="mt-4 max-w-xl">
            {hub.advancedTools.map((tool) => (
              <AdvancedToolRow key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
