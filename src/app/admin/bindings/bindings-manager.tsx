"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ToolContextBindingRow } from "@/db/schema";
import { bindingTypesV1 } from "@/db/schema";
import { SUGGESTED_TOOL_KEYS } from "@/lib/bindings/constants";

type Props = {
  initial: ToolContextBindingRow[];
  dbError: string | null;
};

export function BindingsManager({ initial, dbError }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ToolContextBindingRow[]>(initial);
  const [error, setError] = useState<string | null>(dbError);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/tool-bindings");
    if (!res.ok) {
      setError("Failed to refresh");
      return;
    }
    const data = (await res.json()) as { bindings: ToolContextBindingRow[] };
    setRows(data.bindings);
    router.refresh();
  }

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("create");
    const fd = new FormData(e.currentTarget);
    const tool_key = fd.get("tool_key") as string;
    const binding_type = fd.get("binding_type") as string;
    const targetKind = fd.get("target_kind") as string;
    const docRaw = String(fd.get("document_id") ?? "").trim();
    const rsRaw = String(fd.get("rule_set_id") ?? "").trim();
    const document_id = targetKind === "document" ? docRaw : "";
    const rule_set_id = targetKind === "rule_set" ? rsRaw : "";
    try {
      const res = await fetch("/api/admin/tool-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_key,
          binding_type,
          document_id: document_id || null,
          rule_set_id: rule_set_id || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Create failed");
        setBusy(null);
        return;
      }
      await refresh();
    } catch {
      setError("Create failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish(id: string) {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/tool-bindings/${id}/publish`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Publish failed");
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function archive(id: string) {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/tool-bindings/${id}/archive`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Archive failed");
        return;
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="admin-bindings">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Tool context bindings
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Published bindings are the only authority for which documents and rule sets
          tools resolve to — not latest upload order (CONTENT-002).
        </p>
      </div>

      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          data-testid="admin-bindings-error"
        >
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          New draft binding
        </h2>
        <form className="mt-3 flex flex-col gap-3" onSubmit={onCreate}>
          <label className="flex flex-col gap-1 text-sm">
            <span>tool_key</span>
            <input
              name="tool_key"
              required
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="e.g. credit_copilot"
              list="suggested-tool-keys"
            />
            <datalist id="suggested-tool-keys">
              {SUGGESTED_TOOL_KEYS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>binding_type</span>
            <select
              name="binding_type"
              required
              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-950"
            >
              {bindingTypesV1.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm">Target</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="target_kind" value="document" defaultChecked />
              Document UUID
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="target_kind" value="rule_set" />
              Rule set UUID
            </label>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span>document_id (if document target)</span>
            <input
              name="document_id"
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="uuid"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>rule_set_id (if rule set target)</span>
            <input
              name="rule_set_id"
              className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-950"
              placeholder="uuid"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="w-fit rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Create draft
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Bindings
        </h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-2 pr-2">tool_key</th>
                <th className="py-2 pr-2">binding_type</th>
                <th className="py-2 pr-2">status</th>
                <th className="py-2 pr-2">target</th>
                <th className="py-2">actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-zinc-500">
                    No bindings yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="py-2 pr-2 font-mono text-xs">{r.toolKey}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {r.bindingType}
                    </td>
                    <td className="py-2 pr-2">{r.status}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {r.documentId ?? r.ruleSetId ?? "—"}
                    </td>
                    <td className="py-2">
                      {r.status === "draft" ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          className="text-amber-800 underline dark:text-amber-200"
                          onClick={() => void publish(r.id)}
                        >
                          Publish
                        </button>
                      ) : null}
                      {r.status === "draft" || r.status === "published" ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          className="ml-2 text-zinc-600 underline dark:text-zinc-400"
                          onClick={() => void archive(r.id)}
                        >
                          Archive
                        </button>
                      ) : null}
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
