import type { Metadata } from "next";
import Link from "next/link";
import { AdvancedToolRow } from "@/components/tools/advanced-tool-row";
import { LiveToolCard } from "@/components/tools/live-tool-card";
import { getSessionPayload } from "@/lib/auth/session-server";
import { PRODUCT_TAGLINE } from "@/lib/branding";
import {
  filterHubPageModel,
  hubHeroDescriptionForRole,
  hrefVisibleToRole,
  primaryCtaHrefForRole,
  primaryCtaLabelForRole,
} from "@/lib/tools/tool-visibility";
import {
  CREDIT_COPILOT_TOOL,
  type LiveToolDef,
} from "./tools-registry";

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
  const executionTools = hub.executionSequence.map((item) => item.tool);
  const primaryExecutionTool =
    executionTools.find((tool) => tool.href === primaryHref) ?? executionTools[0];
  const primaryTools = [
    primaryExecutionTool,
    hub.performanceTools[0],
    CREDIT_COPILOT_TOOL,
  ].filter((tool): tool is LiveToolDef => Boolean(tool));
  const primaryHrefs = new Set(primaryTools.map((tool) => tool.href));
  const secondaryTools = [
    ...executionTools,
    ...hub.liveIntelTools,
    ...hub.resourcesTools,
  ].filter(
    (tool, index, tools) =>
      !primaryHrefs.has(tool.href) &&
      tools.findIndex((candidate) => candidate.href === tool.href) === index,
  );

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <section className="relative overflow-hidden rounded-3xl bg-[var(--brand-deep)] px-6 py-8 text-white shadow-[0_24px_55px_rgba(18,63,44,0.16)] sm:px-8 sm:py-10">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 size-72 rounded-full border border-white/10 bg-white/5"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 right-32 size-56 rounded-full border border-white/8"
        />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
            {role === "admin" ? "Admin workspace" : "Rep workspace"}
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Deal work and rep performance, in one place.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-emerald-50/75">
            {hubHeroDescriptionForRole(role)}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[var(--brand-deep)] shadow-sm transition hover:bg-emerald-50"
            >
              Open {primaryLabel}
            </Link>
            <Link
              href="/tools/reviews"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/8 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/14"
            >
              View monthly reviews
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">
              Start here
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              The three places you’ll use most
            </h2>
          </div>
          {hrefVisibleToRole("/tools/deal-analyzer", role) ? (
            <Link
              href="/tools/deal-analyzer"
              className="text-sm font-medium text-[var(--text-muted)] underline underline-offset-4 hover:text-[var(--text-primary)]"
            >
              View JSON harness
            </Link>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {primaryTools.map((tool) => (
            <LiveToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

      {secondaryTools.length > 0 ? (
        <section>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            More tools
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Property context, communication, and additional quoting utilities.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {secondaryTools.map((tool) => (
              <LiveToolCard key={tool.href} tool={tool} />
            ))}
          </div>
        </section>
      ) : null}

      {hub.advancedTools.length > 0 ? (
        <section className="border-t border-[var(--border-subtle)] pt-7">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Advanced / Internal
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
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
