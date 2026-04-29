"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CREDIT_COPILOT_PRIVACY_WARNING } from "@/lib/tools/disclaimer-copy";
import type { CreditCopilotAskResponse } from "@/lib/credit-copilot/types";
import { CreditCopilotResultPanels } from "./credit-copilot-result-panels";

type ChatTurn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; result: CreditCopilotAskResponse };

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type PanelProps = {
  /** Merged onto the root aside (layout shell controls width/borders). */
  className?: string;
};

/**
 * Persistent sidebar chat for policy Q&A — same API as full Credit Copilot page.
 */
export function CreditCopilotPanel({ className }: PanelProps) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading">("idle");
  const [httpError, setHttpError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const formId = useId();

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [turns, phase]);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setHttpError(null);
      const q = input.trim();
      if (!q || phase === "loading") {
        return;
      }
      const userTurn: ChatTurn = { id: newId(), role: "user", text: q };
      setTurns((t) => [...t, userTurn]);
      setInput("");
      setPhase("loading");
      try {
        const res = await fetch("/api/credit-copilot/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
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
          setPhase("idle");
          return;
        }
        if (parsed && typeof parsed === "object" && parsed !== null) {
          const result = parsed as CreditCopilotAskResponse;
          setTurns((t) => [
            ...t,
            { id: newId(), role: "assistant", result },
          ]);
        }
      } catch {
        setHttpError("Network error.");
      } finally {
        setPhase("idle");
      }
    },
    [input, phase],
  );

  const disabled = phase === "loading";

  return (
    <aside
      className={[
        "flex min-h-0 w-full min-w-0 flex-col border-zinc-200 bg-white shadow-sm lg:w-[min(100%,380px)] lg:min-w-[320px] lg:border-r",
        className ?? "",
      ].join(" ")}
      aria-label="Credit Copilot policy chat"
    >
      <header className="flex shrink-0 items-center border-b border-[var(--brand)]/25 bg-[var(--brand)] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Credit Copilot
          </h2>
          <p className="text-[11px] font-medium leading-snug text-white/85">
            Policy Q&amp;A — stays open while you switch tools
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
        role="log"
        aria-live="polite"
      >
        {turns.length === 0 ? (
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            Ask about credit policy — answers use published policy text only. Not an
            underwriting decision.
          </p>
        ) : null}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div
              key={turn.id}
              className="ml-4 rounded-lg border border-[var(--brand)]/15 bg-[var(--bubble-user-bg)] px-3 py-2 text-xs text-[var(--brand)]"
            >
              <p className="whitespace-pre-wrap font-medium leading-relaxed">
                {turn.text}
              </p>
            </div>
          ) : (
            <div
              key={turn.id}
              className="mr-1 rounded-lg border border-zinc-200 bg-zinc-50/80 px-2.5 py-2"
            >
              <CreditCopilotResultPanels result={turn.result} variant="panel" />
            </div>
          ),
        )}

        {phase === "loading" ? (
          <p className="text-xs text-[var(--text-muted)]">Thinking…</p>
        ) : null}

        {httpError ? (
          <div
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-900"
            role="alert"
          >
            {httpError}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-white p-3">
        <p className="mb-2 text-[10px] leading-snug text-amber-900/80">
          {CREDIT_COPILOT_PRIVACY_WARNING}
        </p>
        <form id={formId} onSubmit={submit} className="flex gap-2">
          <label htmlFor={`${formId}-q`} className="sr-only">
            Question
          </label>
          <input
            id={`${formId}-q`}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={disabled}
            placeholder="Ask a policy question…"
            className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-zinc-400 focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={disabled}
            className="shrink-0 rounded-md bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            {disabled ? "…" : "Send ->"}
          </button>
        </form>
      </div>
    </aside>
  );
}
