"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import type { IntelBorrowerOutput } from "@/lib/engines/intel/borrower";

type UiPhase = "idle" | "loading" | "success" | "http_error" | "network_error";

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  medium: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function formatUsd(n: number | null): string | null {
  if (n === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function buyBoxLabel(box: IntelBorrowerOutput["snapshot"]["likelyBuyBox"]): string {
  const low = formatUsd(box.low);
  const high = formatUsd(box.high);
  if (low && high) return `${low} – ${high}`;
  if (low) return `${low}+`;
  if (high) return `Up to ${high}`;
  return "Unknown";
}

/** Borrower Intelligence (INTEL-001) — POST /api/intel/borrower. Internal research only. */
export function BorrowerIntelClient() {
  const [borrowerName, setBorrowerName] = useState("");
  const [entityName, setEntityName] = useState("");
  const [website, setWebsite] = useState("");
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [httpError, setHttpError] = useState<string | null>(null);
  const [result, setResult] = useState<IntelBorrowerOutput | null>(null);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setHttpError(null);
      setResult(null);
      if (!borrowerName.trim()) {
        setHttpError("Enter a borrower name.");
        return;
      }
      setPhase("loading");
      try {
        const res = await fetch("/api/intel/borrower", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            borrowerName: borrowerName.trim(),
            entityName: entityName.trim() || undefined,
            website: website.trim() || undefined,
          }),
        });
        const text = await res.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = undefined;
        }
        if (!res.ok) {
          const err =
            parsed &&
            typeof parsed === "object" &&
            parsed !== null &&
            "error" in parsed &&
            typeof (parsed as { error?: unknown }).error === "string"
              ? (parsed as { error: string }).error
              : `Request failed (${res.status})`;
          setHttpError(err);
          setPhase("http_error");
          return;
        }
        if (parsed && typeof parsed === "object" && parsed !== null) {
          setResult(parsed as IntelBorrowerOutput);
          setPhase("success");
        }
      } catch {
        setPhase("network_error");
        setHttpError("Network error.");
      }
    },
    [borrowerName, entityName, website],
  );

  const disabled = phase === "loading";

  return (
    <div className="flex flex-col gap-8">
      <ToolPageHeader
        href="/tools/borrower-intel"
        disclosure={
          <p className="max-w-2xl text-xs text-[var(--text-muted)]">
            Assembled from public web sources via Firecrawl and summarized by GPT.
            Internal research only — not a credit decision and not for borrowers. Verify
            before relying on any figure.
          </p>
        }
      />

      <form
        onSubmit={submit}
        className="flex max-w-2xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Borrower name <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Jane Investor"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Entity name
          </span>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            disabled={disabled}
            placeholder="e.g. Summit Capital Homes LLC"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Website <span className="text-zinc-400">(optional)</span>
          </span>
          <input
            type="url"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            disabled={disabled}
            placeholder="https://example.com"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {disabled ? "Generating…" : "Generate Intelligence"}
          </button>
        </div>
      </form>

      {phase === "idle" && !result ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter a borrower to assemble a snapshot from public sources.
        </p>
      ) : null}

      {phase === "loading" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gathering public sources and summarizing…
        </p>
      ) : null}

      {(phase === "http_error" || phase === "network_error") && httpError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {httpError}
        </div>
      ) : null}

      {result ? <BorrowerSnapshotCard result={result} /> : null}
    </div>
  );
}

function BorrowerSnapshotCard({ result }: { result: IntelBorrowerOutput }) {
  const { snapshot, sources, degraded, notes, persistedId } = result;
  const confidenceTone = CONFIDENCE_TONE[snapshot.confidence] ?? CONFIDENCE_TONE.low;

  return (
    <div className="flex max-w-2xl flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Borrower Snapshot
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {result.borrowerName}
            {result.entityName ? ` · ${result.entityName}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${confidenceTone}`}
        >
          {snapshot.confidence} confidence
        </span>
      </div>

      <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {snapshot.summary}
      </p>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Experience">
          {snapshot.experience.estimatedFlips !== null
            ? `${snapshot.experience.estimatedFlips} estimated flips`
            : "Not estimated"}
          {snapshot.experience.note ? (
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {snapshot.experience.note}
            </span>
          ) : null}
        </Field>
        <Field label="Likely buy box">
          {buyBoxLabel(snapshot.likelyBuyBox)}
          {snapshot.likelyBuyBox.note ? (
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {snapshot.likelyBuyBox.note}
            </span>
          ) : null}
        </Field>
        <Field label="Primary markets">
          {snapshot.primaryMarkets.length > 0
            ? snapshot.primaryMarkets.join(", ")
            : "Unknown"}
        </Field>
        <Field label="Exit strategy patterns">
          {snapshot.exitStrategyPatterns.length > 0
            ? snapshot.exitStrategyPatterns.join(", ")
            : "Unknown"}
        </Field>
      </dl>

      <Field label="Risk flags">
        {snapshot.riskFlags.length > 0 ? (
          <ul className="mt-1 list-inside list-disc space-y-1">
            {snapshot.riskFlags.map((flag) => (
              <li key={flag} className="text-amber-700 dark:text-amber-300">
                {flag}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300">None found</span>
        )}
      </Field>

      {sources.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sources ({sources.length})
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {sources.map((s) => (
              <li key={s.url} className="truncate">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand)] underline underline-offset-2 hover:opacity-80"
                >
                  {s.title || s.url}
                </a>
                <span className="ml-2 text-xs text-zinc-400">{s.kind}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(degraded.firecrawl || degraded.openai || degraded.db || notes.length > 0) && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Run notes</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {degraded.firecrawl ? <li>Firecrawl not configured — web gathering skipped.</li> : null}
            {degraded.openai ? <li>OpenAI not configured — no GPT summary.</li> : null}
            {degraded.db ? <li>Database unavailable — snapshot not persisted.</li> : null}
            {!degraded.db && persistedId ? <li>Stored (id {persistedId}).</li> : null}
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{children}</dd>
    </div>
  );
}
