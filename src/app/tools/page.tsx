import type { Metadata } from "next";
import Link from "next/link";
import { AdvancedToolRow } from "@/components/tools/advanced-tool-row";
import { ComingSoonRow } from "@/components/tools/coming-soon-row";
import { LiveToolCard } from "@/components/tools/live-tool-card";
import { RuralHubQuickCheck } from "@/components/tools/rural-hub-quick-check";
import { getSessionPayload } from "@/lib/auth/session-server";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import {
  filterHubPageModel,
  hubHeroDescriptionForRole,
  hrefVisibleToRole,
  primaryCtaHrefForRole,
  primaryCtaLabelForRole,
} from "@/lib/tools/tool-visibility";
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
  const workflowSteps = [
    { href: "/tools/loan-structuring-assistant", label: "Deal Structuring Copilot" },
    { href: "/tools/term-sheet", label: "Deal Sheet Builder" },
    { href: "/tools/cash-to-close-estimator", label: "Cash to Close Calculator" },
    { href: "/tools/rural-checker", label: "Rural screening" },
    { href: CREDIT_COPILOT_TOOL.href, label: CREDIT_COPILOT_TOOL.label },
  ].filter((s) => hrefVisibleToRole(s.href, role));

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          {hubHeroDescriptionForRole(role)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={primaryHref}
            className="inline-flex rounded-lg bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            Start with {primaryLabel}
          </Link>
          {hrefVisibleToRole("/tools/deal-analyzer", role) ? (
            <Link
              href="/tools/deal-analyzer"
              className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
            >
              View JSON harness
            </Link>
          ) : null}
        </div>
      </section>

      {hrefVisibleToRole("/tools/rural-checker", role) ? <RuralHubQuickCheck /> : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Suggested path</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Follow this sequence for the fastest handoff-ready workflow.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflowSteps.map((step, index) => (
            <li key={step.href} className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Step {index + 1}
              </p>
              <Link href={step.href} className="mt-1 block text-sm font-medium text-zinc-900 hover:underline">
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </section>

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
            Research and voice — placeholders until shipped.
          </p>
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
