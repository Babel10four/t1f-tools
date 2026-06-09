"use client";

import { useMemo, useState } from "react";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_CATEGORY_ORDER,
  extractTemplateVariables,
  templateToPlainText,
  type EmailTemplate,
  type EmailTemplateCategory,
} from "@/lib/tools/email-templates";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function matchesQuery(t: EmailTemplate, q: string): boolean {
  if (q === "") {
    return true;
  }
  const needle = q.toLowerCase();
  return (
    t.title.toLowerCase().includes(needle) ||
    t.category.toLowerCase().includes(needle) ||
    (t.subject?.toLowerCase().includes(needle) ?? false) ||
    t.body.toLowerCase().includes(needle)
  );
}

export function EmailTemplatesClient() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(EMAIL_TEMPLATES[0]!.id);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const filtered = useMemo(
    () => EMAIL_TEMPLATES.filter((t) => matchesQuery(t, query)),
    [query],
  );

  const grouped = useMemo(() => {
    const map = new Map<EmailTemplateCategory, EmailTemplate[]>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return EMAIL_TEMPLATE_CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      templates: map.get(c)!,
    }));
  }, [filtered]);

  const selected = useMemo(
    () =>
      EMAIL_TEMPLATES.find((t) => t.id === selectedId) ?? EMAIL_TEMPLATES[0]!,
    [selectedId],
  );

  const variables = useMemo(
    () => extractTemplateVariables(selected),
    [selected],
  );

  const flashCopied = (label: string) => {
    setCopyHint(label);
    window.setTimeout(() => setCopyHint(null), 2500);
  };

  const onCopy = async (text: string, label: string) => {
    const ok = await copyText(text);
    flashCopied(ok ? `${label} copied` : "Copy failed — select the text manually");
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Email Templates
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Ready-to-send Tier One Funding email drafts for every stage of a deal. Pick a template,
          copy the subject and body, then replace the{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            {"{{merge fields}}"}
          </code>{" "}
          before sending.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search templates by title, stage, or wording…"
        data-testid="email-templates-search"
        className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />

      <div className="grid gap-6 md:grid-cols-[minmax(220px,300px)_1fr]">
        <nav
          aria-label="Email templates"
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {grouped.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-500">No templates match “{query}”.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="flex flex-col gap-1">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {group.category}
                </p>
                {group.templates.map((t) => {
                  const active = t.id === selected.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      aria-current={active ? "true" : undefined}
                      className={[
                        "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "bg-[var(--brand-muted,#e8f0e9)] font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      {t.title}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </nav>

        <section
          data-testid="email-template-detail"
          className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {selected.category}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {selected.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="copy-entire-email"
                onClick={() => void onCopy(templateToPlainText(selected), "Email")}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Copy entire email
              </button>
            </div>
          </div>

          {copyHint ? (
            <p
              className="text-xs font-medium text-emerald-700 dark:text-emerald-300"
              role="status"
            >
              {copyHint}
            </p>
          ) : null}

          {selected.subject ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Subject
                </span>
                <button
                  type="button"
                  onClick={() => void onCopy(selected.subject!, "Subject")}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Copy
                </button>
              </div>
              <p className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {selected.subject}
              </p>
            </div>
          ) : (
            <p className="text-xs italic text-zinc-500">
              No subject line — intended to be sent inline or as a reply.
            </p>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Body
              </span>
              <button
                type="button"
                data-testid="copy-body"
                onClick={() => void onCopy(selected.body, "Body")}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Copy
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-zinc-50 px-4 py-3 font-sans text-sm leading-relaxed text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
              {selected.body}
            </pre>
          </div>

          {variables.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fill in before sending ({variables.length})
              </span>
              <ul className="flex flex-wrap gap-2">
                {variables.map((v) => (
                  <li
                    key={v}
                    className="rounded-full bg-amber-100 px-2.5 py-1 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  >
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
