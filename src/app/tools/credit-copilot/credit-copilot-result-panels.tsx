import type { ReactNode } from "react";
import type { CreditCopilotAskResponse } from "@/lib/credit-copilot/types";

export type CopilotResultVariant = "page" | "panel";

export function CreditCopilotResultPanels({
  result,
  variant = "page",
}: {
  result: CreditCopilotAskResponse;
  variant?: CopilotResultVariant;
}) {
  const compact = variant === "panel";

  if (result.status === "policy_unavailable") {
    return (
      <StatusCallout title="Policy unavailable" variant="amber" disclaimer={result.disclaimer}>
        <p>{result.answer}</p>
        {result.warnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-sm">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </StatusCallout>
    );
  }
  if (result.status === "insufficient_policy_context") {
    return (
      <StatusCallout
        title="Insufficient policy context"
        variant="amber"
        disclaimer={result.disclaimer}
      >
        <p>{result.answer ?? "No clear answer from retrieved policy text."}</p>
        {result.warnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-sm">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </StatusCallout>
    );
  }
  if (result.status === "refused_sensitive_or_decision_request") {
    return (
      <StatusCallout
        title="Cannot answer as asked"
        variant="amber"
        disclaimer={result.disclaimer}
      >
        <p>{result.answer}</p>
        <ul className="mt-2 list-inside list-disc text-sm">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </StatusCallout>
    );
  }
  if (result.status === "error") {
    return (
      <StatusCallout title="Error" variant="red" disclaimer={result.disclaimer}>
        <p>{result.warnings[0] ?? "Unexpected error."}</p>
      </StatusCallout>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-2.5">
        {result.sourceDocument ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50/80 px-2.5 py-1.5 text-[11px] text-zinc-800">
            <span className="font-medium text-zinc-900">Source: </span>
            {result.sourceDocument.title}
            {result.sourceDocument.versionLabel
              ? ` — ${result.sourceDocument.versionLabel}`
              : ""}
          </div>
        ) : null}
        <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-2">
          <p className="text-[11px] font-medium text-zinc-900">Answer</p>
          <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-800">
            {result.answer ?? "—"}
          </div>
          {result.warnings.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-[11px] text-amber-900/90">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {result.citations.length > 0 ? (
          <p className="text-[10px] text-zinc-500">
            {result.citations.length} citation{result.citations.length === 1 ? "" : "s"} — open
            full Credit Copilot page for excerpts.
          </p>
        ) : null}
        <p className="text-[10px] leading-snug text-zinc-500">{result.disclaimer}</p>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {result.sourceDocument ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <h2 className="font-semibold text-zinc-900">Source</h2>
          <p className="mt-1 text-zinc-700">
            {result.sourceDocument.title}
            {result.sourceDocument.versionLabel
              ? ` — ${result.sourceDocument.versionLabel}`
              : ""}
          </p>
          {result.sourceDocument.publishedAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              Published: {result.sourceDocument.publishedAt}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Answer</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">
          {result.answer ?? "—"}
        </div>
        {result.warnings.length > 0 ? (
          <ul className="mt-4 list-inside list-disc text-sm text-amber-900">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {result.citations.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Citations</h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {result.citations.map((c) => (
              <li key={c.chunkId ?? c.label}>
                <span className="font-medium text-zinc-800">{c.label}</span>
                {c.excerpt ? (
                  <p className="mt-1 text-zinc-600">{c.excerpt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">{result.disclaimer}</p>
    </div>
  );
}

function StatusCallout({
  title,
  variant,
  disclaimer,
  children,
}: {
  title: string;
  variant: "amber" | "red";
  disclaimer: string;
  children: ReactNode;
}) {
  const box =
    variant === "amber"
      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
      : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${box}`}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="mt-2 text-zinc-800 dark:text-zinc-200">{children}</div>
      <p className="mt-4 text-xs text-zinc-500">{disclaimer}</p>
    </div>
  );
}
