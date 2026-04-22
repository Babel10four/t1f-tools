"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { RuleSetRow } from "@/db/schema";
import { RULE_TYPES, type RuleType } from "@/lib/rule-sets/constants";

const EXAMPLE_PAYLOADS: Record<RuleType, string> = {
  rates: `{
  "schemaVersion": 1,
  "rateTables": [
    { "id": "sample", "label": "Sample", "rows": [{ "term": "12m", "rate": 9.25 }] }
  ]
}`,
  calculator_assumptions: `{
  "schemaVersion": 1,
  "assumptions": { "maxLtv": 75, "minFico": 620 }
}`,
  rural_rules: `{
  "schemaVersion": 1,
  "evaluation": {
    "version": 1,
    "population": {
      "likelyRuralIfLte": 50000,
      "likelyNotRuralIfGte": 250000,
      "scoreIfRuralLean": 2,
      "scoreIfNotRuralLean": -2,
      "scoreIfBetween": 0,
      "scoreIfMissing": 0
    },
    "msa": {
      "likelyNotRuralIfTrue": true,
      "scoreIfInMsaPenalty": -2,
      "scoreIfInMsaNoPenalty": 0,
      "scoreIfNotInMsa": 1,
      "scoreIfMissing": 0
    },
    "userRuralIndicator": {
      "likelyRuralIfTrue": true,
      "scoreIfTrue": 1,
      "scoreIfFalse": -1,
      "scoreIfMissing": 0
    },
    "scores": {
      "likelyRuralMin": 2,
      "likelyNotRuralMax": -1,
      "needsReviewBandMin": -1,
      "needsReviewBandMax": 1
    }
  },
  "rules": []
}`,
};

type Props = {
  initial: RuleSetRow[];
};

export function RulesManager({ initial }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<RuleSetRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<RuleType | "">("");
  const [filterStatus, setFilterStatus] = useState<
    "draft" | "published" | "archived" | ""
  >("");

  const seriesOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (!m.has(r.seriesId)) {
        m.set(r.seriesId, `${r.ruleType} · ${r.versionLabel}`);
      }
    }
    return Array.from(m.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  async function refresh() {
    const params = new URLSearchParams();
    if (filterKind) {
      params.set("rule_type", filterKind);
    }
    if (filterStatus) {
      params.set("status", filterStatus);
    }
    const q = params.toString();
    const res = await fetch(
      `/api/admin/rule-sets${q ? `?${q}` : ""}`,
    );
    if (!res.ok) {
      setError("Failed to refresh list");
      return;
    }
    const data = (await res.json()) as { ruleSets: RuleSetRow[] };
    setRows(data.ruleSets);
    router.refresh();
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    const fd = new FormData(e.currentTarget);
    const rule_type = fd.get("rule_type") as string;
    const version_label = fd.get("version_label") as string;
    const effective_date = fd.get("effective_date") as string;
    const series_id = fd.get("series_id") as string;
    const source_document_id = fd.get("source_document_id") as string;
    const payloadText = fd.get("json_payload") as string;
    let json_payload: unknown;
    try {
      json_payload = JSON.parse(payloadText);
    } catch {
      setError("Invalid JSON");
      setBusy(null);
      return;
    }
    try {
      const res = await fetch("/api/admin/rule-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type,
          version_label,
          effective_date: effective_date || null,
          series_id: series_id || undefined,
          source_document_id: source_document_id.trim() || null,
          json_payload,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Create failed");
        setBusy(null);
        return;
      }
      e.currentTarget.reset();
      await refresh();
    } catch {
      setError("Create failed");
    }
    setBusy(null);
  }

  async function postAction(path: string): Promise<void> {
    setError(null);
    setBusy(path);
    try {
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Action failed");
        setBusy(null);
        return;
      }
      await refresh();
    } catch {
      setError("Action failed");
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-8" data-testid="admin-rules">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Rule Sets & Rates
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Structured config per CONFIG-001 — v1 kinds only. Payloads are
          schema-validated server-side; tools do not consume these rows until
          CONTENT-002.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <section className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Kind
          <select
            value={filterKind}
            onChange={(e) =>
              setFilterKind((e.target.value || "") as RuleType | "")
            }
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">All</option>
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Status
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(
                (e.target.value || "") as typeof filterStatus,
              )
            }
            className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">All</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
          onClick={() => void refresh()}
        >
          Apply filters
        </button>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Create draft
        </h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={onCreate}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              rule_type
              <select
                name="rule_type"
                required
                disabled={!!busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              >
                {RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              version_label
              <input
                name="version_label"
                required
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              effective_date
              <input
                name="effective_date"
                type="date"
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              series_id (optional)
              <select
                name="series_id"
                disabled={!!busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="">New series</option>
                {seriesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              source_document_id (optional UUID)
              <input
                name="source_document_id"
                placeholder="00000000-0000-0000-0000-000000000000"
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            json_payload
            <textarea
              name="json_payload"
              required
              rows={12}
              disabled={!!busy}
              defaultValue={EXAMPLE_PAYLOADS.rates}
              className="rounded border border-zinc-300 px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Examples: see{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              docs/specs/CONFIG-001-schemas.md
            </code>
            .
          </p>
          <button
            type="submit"
            disabled={!!busy}
            className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-800 dark:hover:bg-amber-700"
          >
            {busy === "create" ? "Saving…" : "Save draft"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Rule sets ({rows.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Effective</th>
                <th className="px-3 py-2 font-medium">Source doc</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-zinc-500"
                    data-testid="admin-rules-empty"
                  >
                    No rule sets yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{r.ruleType}</td>
                    <td className="px-3 py-2">{r.versionLabel}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status === "published"
                            ? "text-green-800 dark:text-green-300"
                            : r.status === "draft"
                              ? "text-amber-800 dark:text-amber-200"
                              : "text-zinc-600 dark:text-zinc-400"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.effectiveDate ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.sourceDocumentId ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {r.status === "draft" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-amber-900 underline disabled:opacity-50 dark:text-amber-200"
                            onClick={() =>
                              void postAction(
                                `/api/admin/rule-sets/${r.id}/publish`,
                              )
                            }
                          >
                            Publish
                          </button>
                        ) : null}
                        {r.status === "archived" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-amber-900 underline disabled:opacity-50 dark:text-amber-200"
                            onClick={() =>
                              void postAction(
                                `/api/admin/rule-sets/${r.id}/rollback`,
                              )
                            }
                          >
                            Rollback
                          </button>
                        ) : null}
                        {r.status !== "archived" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400"
                            onClick={() =>
                              void postAction(
                                `/api/admin/rule-sets/${r.id}/archive`,
                              )
                            }
                          >
                            Archive
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
