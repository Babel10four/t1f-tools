"use client";

import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { DisclosureBanner } from "@/components/tools/disclosure-banner";
import type { CreditCopilotAskResponse } from "@/lib/credit-copilot/types";
import {
  CREDIT_COPILOT_DISCLAIMER_SUMMARY,
  CREDIT_COPILOT_PRIVACY_WARNING,
} from "@/lib/tools/disclaimer-copy";
import { CreditCopilotResultPanels } from "./credit-copilot-result-panels";

type UiPhase =
  | "idle"
  | "loading"
  | "success"
  | "http_error"
  | "network_error";

/**
 * Credit Copilot v1 — POST /api/credit-copilot/ask (TICKET-009). Internal only.
 */
export function CreditCopilotClient() {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [httpError, setHttpError] = useState<string | null>(null);
  const [result, setResult] = useState<CreditCopilotAskResponse | null>(null);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setHttpError(null);
      setResult(null);
      const q = question.trim();
      if (!q) {
        setHttpError("Enter a question.");
        return;
      }
      setPhase("loading");
      try {
        const res = await fetch("/api/credit-copilot/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
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
          setResult(parsed as CreditCopilotAskResponse);
          setPhase("success");
        }
      } catch {
        setPhase("network_error");
        setHttpError("Network error.");
      }
    },
    [question],
  );

  const disabled = phase === "loading";

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Credit Copilot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Internal policy Q&A for Vanguard by TheFoundry — answers are grounded only in
          the published credit policy (stored extracted text). Not an underwriting
          decision and not for borrowers. The Credit Copilot chat stays open between
          the tool rail and this canvas for quick questions; use this page for the full
          answer layout and citations.
        </p>
      </header>

      <DisclosureBanner
        summary={
          <>
            <strong className="font-medium">Privacy:</strong>{" "}
            {CREDIT_COPILOT_PRIVACY_WARNING}
          </>
        }
        details={<p>{CREDIT_COPILOT_DISCLAIMER_SUMMARY}</p>}
        tone="warning"
      />

      <form
        onSubmit={submit}
        className="flex max-w-2xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Question
          </span>
          <textarea
            className="min-h-[120px] rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={disabled}
            placeholder="e.g. What documentation does the policy require for self-employed income?"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center justify-center rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {disabled ? "Asking…" : "Ask ?"}
          </button>
        </div>
      </form>

      {phase === "idle" && !result ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ask a policy question to see grounded excerpts and guidance here.
        </p>
      ) : null}

      {phase === "loading" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
      ) : null}

      {(phase === "http_error" || phase === "network_error") && httpError ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {httpError}
        </div>
      ) : null}

      {result ? (
        <CreditCopilotResultPanels result={result} variant="page" />
      ) : null}
    </div>
  );
}
