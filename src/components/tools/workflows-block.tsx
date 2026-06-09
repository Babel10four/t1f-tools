import Link from "next/link";
import { Fragment } from "react";
import type { Workflow } from "@/lib/tools/workflows";
import { Card } from "@/components/ui/card";

/**
 * Hub "Workflows" recipes — ordered, clickable jump-orders across standalone tools. Pure navigation;
 * these never change any tool's UI or behavior.
 */
export function WorkflowsBlock({ workflows }: { workflows: Workflow[] }) {
  if (workflows.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Workflows
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Suggested jump-orders across tools — each tool still works on its own.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <Card key={workflow.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {workflow.title}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {workflow.description}
            </p>
            <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
              {workflow.steps.map((step, i) => (
                <Fragment key={step.href}>
                  {i > 0 ? (
                    <span aria-hidden className="text-[var(--text-muted)]">
                      →
                    </span>
                  ) : null}
                  <li>
                    <Link
                      href={step.href}
                      className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
                    >
                      {step.label}
                    </Link>
                  </li>
                </Fragment>
              ))}
            </ol>
          </Card>
        ))}
      </div>
    </section>
  );
}
