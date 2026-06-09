import type { Metadata } from "next";
import Link from "next/link";
import { AdvancedToolRow } from "@/components/tools/advanced-tool-row";
import { ComingSoonRow } from "@/components/tools/coming-soon-row";
import { LiveToolCard } from "@/components/tools/live-tool-card";
import { RuralHubQuickCheck } from "@/components/tools/rural-hub-quick-check";
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
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            Tool Hub
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

      {hrefVisibleToRole("/tools/rural-checker", role) ? <RuralHubQuickCheck /> : null}

      <WorkflowsBlock workflows={workflows} />

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Execution Layer
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Deal workflow tools backed by{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            POST /api/deal/analyze
          </code>{" "}
          where noted. Placeholders are not production-ready.
        </p>
        <div className="mt-6 flex max-w-3xl flex-col gap-4">
          {hub.executionSequence.map((item, i) =>
            item.kind === "live" ? (
              <LiveToolCard key={item.tool.href} tool={item.tool} />
            ) : (
              <ComingSoonRow key={`${item.tool.href}-${i}`} tool={item.tool} />
            ),
          )}
        </div>
      </section>

      {hub.showIntelSection ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Intel Layer
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Automated research via Firecrawl + GPT. Voice and remaining tools are placeholders
            until shipped.
          </p>
          {hub.liveIntelTools.length > 0 ? (
            <div className="mt-6 flex max-w-3xl flex-col gap-4">
              {hub.liveIntelTools.map((tool) => (
                <LiveToolCard key={tool.href} tool={tool} />
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-3">
            {hub.intelPlaceholders.map((tool) => (
              <ComingSoonRow key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Decision Layer
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Policy Q&A — grounded in published credit policy text (not a credit pull).
        </p>
        <div className="mt-4 flex max-w-3xl flex-col gap-4">
          <LiveToolCard tool={CREDIT_COPILOT_TOOL} />
        </div>
      </section>

      {hub.showResourcesSection ? (
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Resources
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Reusable rep content — copy, personalize, and send.
          </p>
          <div className="mt-4 flex max-w-3xl flex-col gap-4">
            {hub.resourcesTools.map((tool) => (
              <LiveToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      ) : null}

      {hub.showAdvancedSection ? (
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
