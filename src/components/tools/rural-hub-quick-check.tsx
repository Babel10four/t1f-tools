"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ruralScreeningHeading } from "@/lib/engines/property/rural-evidence-report";
import type { PropertyRuralResponseV1 } from "@/lib/engines/property/rural-types";
import { RURAL_HUB_EXPAND_SESSION_KEY } from "@/lib/tools/rural-hub-session";

export { RURAL_HUB_EXPAND_SESSION_KEY } from "@/lib/tools/rural-hub-session";

/**
 * Compact rural screening on the Tool Hub after login. Uses the same
 * `POST /api/property/rural` path as the full checker (published rural_rules +
 * optional free Census Geocoder / ACS / OSM enrichment — no paid APIs).
 */
export function RuralHubQuickCheck() {
  const [open, setOpen] = useState(false);
  const [addressLine, setAddressLine] = useState("");
  const [stateAbbr, setStateAbbr] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PropertyRuralResponseV1 | null>(null);

  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        return;
      }
      if (window.sessionStorage.getItem(RURAL_HUB_EXPAND_SESSION_KEY) === "1") {
        setOpen(true);
        window.sessionStorage.removeItem(RURAL_HUB_EXPAND_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setResponse(null);
      const line = addressLine.trim();
      if (!line) {
        setError("Enter a street address (U.S.) for the best read.");
        return;
      }
      setPending(true);
      try {
        const body: Record<string, unknown> = { addressLine: line };
        const st = stateAbbr.trim();
        if (st) {
          body.state = st;
        }
        const res = await fetch("/api/property/rural", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
          setError(err);
          return;
        }
        if (parsed && typeof parsed === "object" && parsed !== null) {
          setResponse(parsed as PropertyRuralResponseV1);
        }
      } catch {
        setError("Network error.");
      } finally {
        setPending(false);
      }
    },
    [addressLine, stateAbbr],
  );

  return (
    <section
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-chrome)] p-5 shadow-sm"
      data-testid="rural-hub-quick-check"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Rural property screening
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Criterion-style public evidence plus published{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
              rural_rules
            </code>{" "}
            scoring. Address line triggers Census geocoder + ACS tract/BG density and
            OSM distances (same free pipeline as the full Rural Checker). Not a legal or
            compliance determination.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"} form
        </button>
      </div>

      {open ? (
        <form className="mt-4 flex max-w-xl flex-col gap-3" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Street address (U.S.)
            </span>
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="123 Main St, City, ST 12345"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              disabled={pending}
              data-testid="rural-hub-address"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              State (optional hint)
            </span>
            <input
              value={stateAbbr}
              onChange={(e) => setStateAbbr(e.target.value)}
              placeholder="e.g. TX"
              maxLength={2}
              className="max-w-[6rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 uppercase text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              disabled={pending}
              data-testid="rural-hub-state"
            />
          </label>
          {error ? (
            <p className="text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
              data-testid="rural-hub-submit"
            >
              {pending ? "Checking…" : "Check rural read"}
            </button>
            <Link
              href="/tools/rural-checker"
              className="text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Open full Rural Checker
            </Link>
          </div>
        </form>
      ) : null}

      {response ? (
        <div
          className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900/40"
          data-testid="rural-hub-result"
        >
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            {ruralScreeningHeading(response)}{" "}
            <span className="font-normal text-zinc-500">({response.certainty} certainty)</span>
          </p>
          {response.reasons.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-zinc-700 dark:text-zinc-300">
              {response.reasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">{response.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
