"use client";

import { useCallback, useState } from "react";

const DEFAULT_BODY = `{
  "schemaVersion": "deal_analyze.v1",
  "deal": {
    "purpose": "purchase",
    "productType": "bridge_purchase",
    "purchasePrice": 350000,
    "rehabBudget": 0,
    "termMonths": null
  },
  "property": {
    "arv": 420000
  },
  "borrower": {
    "fico": 720
  }
}`;

type DealAnalyzeErrorBody = {
  error?: string;
  code?: string;
  issues?: { path?: string; message?: string }[];
};

export default function DealAnalyzerPage() {
  const [body, setBody] = useState(DEFAULT_BODY);
  const [status, setStatus] = useState<number | null>(null);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<DealAnalyzeErrorBody | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    setOutput("");
    setStatus(null);
    try {
      const res = await fetch("/api/deal/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-T1F-Tool-Key": "deal_analyzer",
        },
        body: body.trim() || "{}",
      });
      setStatus(res.status);
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      if (typeof parsed === "object" && parsed !== null) {
        setOutput(JSON.stringify(parsed, null, 2));
      } else {
        setOutput(text);
      }
      if (!res.ok) {
        if (
          res.status >= 400 &&
          res.status < 500 &&
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          const o = parsed as DealAnalyzeErrorBody;
          setErrorDetail({
            error: typeof o.error === "string" ? o.error : undefined,
            code: typeof o.code === "string" ? o.code : undefined,
            issues: Array.isArray(o.issues) ? o.issues : undefined,
          });
        }
        setError(`HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [body]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Deal Analyzer (JSON harness)
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">
            Internal JSON harness
          </strong>{" "}
          for{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            POST /api/deal/analyze
          </code>
          . Edit raw JSON to verify the contract. Rep-facing UI:{" "}
          <a
            href="/tools/loan-structuring-assistant"
            className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
          >
            Deal Structuring Copilot
          </a>
          .
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="deal-analyze-body"
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          Request JSON
        </label>
        <textarea
          id="deal-analyze-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={16}
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          spellCheck={false}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Sending…" : "Analyze"}
          </button>
          {status !== null ? (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Status: <strong>{status}</strong>
            </span>
          ) : null}
          {error ? (
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          ) : null}
        </div>
        {errorDetail && (errorDetail.error || errorDetail.code || errorDetail.issues) ? (
          <div
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
            role="alert"
          >
            {errorDetail.error ? (
              <p className="font-medium">{errorDetail.error}</p>
            ) : null}
            {errorDetail.code ? (
              <p className="mt-1 font-mono text-xs">code: {errorDetail.code}</p>
            ) : null}
            {errorDetail.issues && errorDetail.issues.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                {errorDetail.issues.map((issue, i) => (
                  <li key={i}>
                    {issue.path ? (
                      <span className="font-mono">{issue.path}: </span>
                    ) : null}
                    {issue.message ?? ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {output ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Response
          </h2>
          <pre className="max-h-[480px] overflow-auto rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            {output}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
