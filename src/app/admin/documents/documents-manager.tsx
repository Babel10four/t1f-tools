"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DocumentRow } from "@/db/schema";

import { DOCUMENT_TYPES } from "@/lib/documents/constants";

type Props = {
  initial: DocumentRow[];
};

export function DocumentsManager({ initial }: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const seriesOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of docs) {
      if (!m.has(d.seriesId)) {
        m.set(d.seriesId, d.title);
      }
    }
    return Array.from(m.entries()).map(([id, label]) => ({ id, label }));
  }, [docs]);

  async function refresh() {
    const res = await fetch("/api/admin/documents");
    if (!res.ok) {
      setError("Failed to refresh list");
      return;
    }
    const data = (await res.json()) as { documents: DocumentRow[] };
    setDocs(data.documents);
    router.refresh();
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("upload");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/documents/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Upload failed");
        setBusy(null);
        return;
      }
      e.currentTarget.reset();
      await refresh();
    } catch {
      setError("Upload failed");
    }
    setBusy(null);
  }

  async function postAction(
    path: string,
    id: string,
  ): Promise<boolean> {
    setError(null);
    setBusy(id + path);
    try {
      const res = await fetch(path, { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Action failed");
        setBusy(null);
        return false;
      }
      await refresh();
      setBusy(null);
      return true;
    } catch {
      setError("Action failed");
      setBusy(null);
      return false;
    }
  }

  return (
    <div className="flex flex-col gap-8" data-testid="admin-documents">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Documents
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          PDF library — metadata in Postgres, files in object storage (or local
          dev). Draft → publish; rollback restores a prior archived version in
          the same series.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Upload PDF
        </h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={onUpload}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>File (PDF only)</span>
              <input
                name="file"
                type="file"
                accept="application/pdf"
                required
                disabled={!!busy}
                className="text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Document type</span>
              <select
                name="doc_type"
                required
                disabled={!!busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Title</span>
              <input
                name="title"
                required
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Version label</span>
              <input
                name="version_label"
                required
                placeholder="e.g. 2026-Q1"
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Effective date</span>
              <input
                name="effective_date"
                type="date"
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Series (optional — pick existing for a new version)</span>
              <select
                name="series_id"
                disabled={!!busy}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              >
                <option value="">New series</option>
                {seriesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.id.slice(0, 8)}…)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span>Notes (optional)</span>
              <input
                name="notes"
                disabled={!!busy}
                className="rounded border border-zinc-300 px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={!!busy}
            className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-800 dark:hover:bg-amber-700"
          >
            {busy === "upload" ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Library ({docs.length})
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Effective</th>
                <th className="px-3 py-2 font-medium">Published</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-zinc-500"
                    data-testid="admin-documents-empty"
                  >
                    No documents yet.
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-medium">{d.title}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.docType}</td>
                    <td className="px-3 py-2">{d.versionLabel}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          d.status === "published"
                            ? "text-green-800 dark:text-green-300"
                            : d.status === "draft"
                              ? "text-amber-800 dark:text-amber-200"
                              : "text-zinc-600 dark:text-zinc-400"
                        }
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {d.effectiveDate ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {d.publishedAt
                        ? new Date(d.publishedAt).toISOString().slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/api/admin/documents/${d.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-900 underline dark:text-amber-200"
                        >
                          View
                        </a>
                        {d.status === "draft" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-amber-900 underline disabled:opacity-50 dark:text-amber-200"
                            onClick={() =>
                              void postAction(
                                `/api/admin/documents/${d.id}/publish`,
                                d.id,
                              )
                            }
                          >
                            Publish
                          </button>
                        ) : null}
                        {d.status === "archived" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-amber-900 underline disabled:opacity-50 dark:text-amber-200"
                            onClick={() =>
                              void postAction(
                                `/api/admin/documents/${d.id}/rollback`,
                                d.id,
                              )
                            }
                          >
                            Rollback
                          </button>
                        ) : null}
                        {d.status !== "archived" ? (
                          <button
                            type="button"
                            disabled={!!busy}
                            className="text-sm text-zinc-600 underline disabled:opacity-50 dark:text-zinc-400"
                            onClick={() =>
                              void postAction(
                                `/api/admin/documents/${d.id}/archive`,
                                d.id,
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

      {docs.some((d) => d.extractedText) ? (
        <section className="text-xs text-zinc-500">
          <p>
            Text extraction preview is stored for search/RAG later; not shown in
            v1 UI.
          </p>
        </section>
      ) : null}
    </div>
  );
}
