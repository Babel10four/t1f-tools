import type { Metadata } from "next";
import Link from "next/link";
import { AdvancedToolRow } from "@/components/tools/advanced-tool-row";
import { ComingSoonRow } from "@/components/tools/coming-soon-row";
import { LiveToolCard } from "@/components/tools/live-tool-card";
import { HUB_PRIMARY_CTA_HREF, PRODUCT_TAGLINE } from "@/lib/branding";
import {
  ADVANCED_TOOLS,
  CREDIT_COPILOT_TOOL,
  EXECUTION_LAYER_SEQUENCE,
  INTEL_PLACEHOLDER_TOOLS,
  LIVE_TOOLS,
} from "./tools-registry";

export const metadata: Metadata = {
  title: "Tool Hub",
  description: PRODUCT_TAGLINE,
};

/**
 * Hub primary CTA: first live execution tool (Deal Structuring Copilot).
 */
export default function ToolsHubPage() {
  const primaryCta = LIVE_TOOLS[0]!;

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Pick a tool below or use the JSON harness under Advanced / Internal when you
          need raw requests — not a generic loan portal.
        </p>
        <div>
          <Link
            href={HUB_PRIMARY_CTA_HREF}
            className="inline-flex rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Start with {primaryCta.label}
          </Link>
        </div>
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
          {EXECUTION_LAYER_SEQUENCE.map((item, i) =>
            item.kind === "live" ? (
              <LiveToolCard key={item.tool.href} tool={item.tool} />
            ) : (
              <ComingSoonRow key={`${item.tool.href}-${i}`} tool={item.tool} />
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Intel Layer
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Research and voice — placeholders until shipped.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {INTEL_PLACEHOLDER_TOOLS.map((tool) => (
            <ComingSoonRow key={tool.href} tool={tool} />
          ))}
        </div>
      </section>

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

      <section>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Advanced / Internal
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Engineer-oriented and contract-check tools — not primary rep workflows.
        </p>
        <div className="mt-4 max-w-xl">
          {ADVANCED_TOOLS.map((tool) => (
            <AdvancedToolRow key={tool.href} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
