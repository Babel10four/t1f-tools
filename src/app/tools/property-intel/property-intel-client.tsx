"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import type { PropertyDossierOutput } from "@/lib/engines/property/dossier";

type UiPhase = "idle" | "loading" | "success" | "http_error" | "network_error";

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  medium: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** Property Intelligence (INTEL-001) — POST /api/property/dossier. Internal research only. */
export function PropertyIntelClient() {
  const [address, setAddress] = useState("");
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [httpError, setHttpError] = useState<string | null>(null);
  const [result, setResult] = useState<PropertyDossierOutput | null>(null);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setHttpError(null);
      setResult(null);
      if (!address.trim()) {
        setHttpError("Enter a property address.");
        return;
      }
      setPhase("loading");
      try {
        const res = await fetch("/api/property/dossier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: address.trim() }),
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
          setResult(parsed as PropertyDossierOutput);
          setPhase("success");
        }
      } catch {
        setPhase("network_error");
        setHttpError("Network error.");
      }
    },
    [address],
  );

  const disabled = phase === "loading";

  return (
    <div className="flex flex-col gap-8">
      <ToolPageHeader
        href="/tools/property-intel"
        disclosure={
          <p className="max-w-2xl text-xs text-[var(--text-muted)]">
            Assembled from public listing and records sources via Firecrawl and GPT.
            Internal research only; verify before relying on any figure.
          </p>
        }
      />

      <form
        onSubmit={submit}
        className="flex max-w-2xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Property address <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={disabled}
            placeholder="e.g. 115 Lilley Ln, Johnson City, TN 37604"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {disabled ? "Assembling…" : "Generate Dossier"}
          </button>
        </div>
      </form>

      {phase === "idle" && !result ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Enter an address to assemble a dossier from public sources.
        </p>
      ) : null}

      {phase === "loading" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Gathering listing and records sources…
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

      {result ? <PropertyDossierCard result={result} /> : null}
    </div>
  );
}

function PropertyDossierCard({ result }: { result: PropertyDossierOutput }) {
  const { dossier, sources, degraded, notes, persistedId } = result;
  const confidenceTone = CONFIDENCE_TONE[dossier.confidence] ?? CONFIDENCE_TONE.low;

  return (
    <div className="flex max-w-2xl flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Property Dossier
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {result.address}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${confidenceTone}`}
        >
          {dossier.confidence} confidence
        </span>
      </div>

      <ListSection label="Listing history" items={dossier.listingHistory} />
      <ListSection label="Price changes" items={dossier.priceChanges} />
      <ListSection label="Prior sales" items={dossier.priorSales} />
      <ListSection label="Tax history" items={dossier.taxHistory} />

      {dossier.marketNotes ? (
        <NoteSection label="Market notes" text={dossier.marketNotes} />
      ) : null}
      {dossier.neighborhoodNotes ? (
        <NoteSection label="Neighborhood notes" text={dossier.neighborhoodNotes} />
      ) : null}

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
            {degraded.db ? <li>Database unavailable — dossier not persisted.</li> : null}
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

function ListSection({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-zinc-800 dark:text-zinc-200">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">No data found.</p>
      )}
    </div>
  );
}

function NoteSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{text}</p>
    </div>
  );
}
