"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildDealAnalyzeRequest,
  type LoanAssistantFields,
  type LoanAssistantFlow,
} from "./build-deal-analyze-request";
import {
  formatMoney,
  groupRisksBySeverity,
  sortAnalysisFlagsForDisplay,
} from "./display-helpers";
import { buildLoanAssistantEmailSummary } from "./build-email-summary";

const EMPTY_FIELDS: LoanAssistantFields = {
  purchasePrice: "",
  rehabBudget: "",
  arv: "",
  requestedLoanAmount: "",
  termMonths: "",
  fico: "",
  experienceTier: "",
  payoffAmount: "",
  asIsValue: "",
  borrowingRehabFunds: "yes",
  originationPointsPercent: "",
  originationFlatFee: "",
  noteRatePercent: "",
};

type DealAnalyzeErrorBody = {
  error?: string;
  code?: string;
  issues?: { path?: string; message?: string }[];
};

type UiPhase =
  | "idle"
  | "editing"
  | "submitting"
  | "success"
  | "error_4xx"
  | "error_5xx";

export function LoanStructuringAssistantClient() {
  const [flow, setFlow] = useState<LoanAssistantFlow>("purchase");
  const [fields, setFields] = useState<LoanAssistantFields>(EMPTY_FIELDS);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [clientHint, setClientHint] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    response: DealAnalyzeResponseV1;
    request: DealAnalyzeRequestV1;
  } | null>(null);
  const [error4xx, setError4xx] = useState<DealAnalyzeErrorBody | null>(null);
  const [error5xx, setError5xx] = useState<string | null>(null);
  const [copiedEmailSummary, setCopiedEmailSummary] = useState(false);

  const disabled = phase === "submitting";

  const onField =
    (key: keyof LoanAssistantFields) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setFields((f) => ({ ...f, [key]: e.target.value }));
      setClientHint(null);
      if (phase === "success" || phase === "error_4xx" || phase === "error_5xx") {
        setPhase("editing");
      } else if (phase === "idle") {
        setPhase("editing");
      }
    };

  const onFlowChange = (next: LoanAssistantFlow) => {
    setFlow(next);
    setClientHint(null);
    if (phase === "success" || phase === "error_4xx" || phase === "error_5xx") {
      setPhase("editing");
    } else if (phase === "idle") {
      setPhase("editing");
    }
  };

  const onBorrowingRehabChange = (next: "yes" | "no") => {
    setFields((f) => ({ ...f, borrowingRehabFunds: next }));
    setClientHint(null);
    if (phase === "success" || phase === "error_4xx" || phase === "error_5xx") {
      setPhase("editing");
    } else if (phase === "idle") {
      setPhase("editing");
    }
  };

  const runAnalyze = useCallback(async () => {
    const built = buildDealAnalyzeRequest(flow, fields);
    if (!built.ok) {
      setClientHint(built.clientHint);
      setPhase("editing");
      return;
    }
    setClientHint(null);
    setError4xx(null);
    setError5xx(null);
    setSuccessPayload(null);
    setPhase("submitting");

    try {
      const res = await fetch("/api/deal/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-T1F-Tool-Key": "loan_structuring_assistant",
        },
        body: JSON.stringify(built.request),
      });

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }

      if (res.ok && res.status === 200 && parsed && typeof parsed === "object") {
        setSuccessPayload({
          response: parsed as DealAnalyzeResponseV1,
          request: built.request,
        });
        setPhase("success");
        return;
      }

      if (res.status >= 400 && res.status < 500) {
        const body: DealAnalyzeErrorBody =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as DealAnalyzeErrorBody)
            : {};
        setError4xx(body);
        setPhase("error_4xx");
        return;
      }

      setError5xx(`Server error (HTTP ${res.status}).`);
      setPhase("error_5xx");
    } catch (e) {
      setError5xx(e instanceof Error ? e.message : "Network error.");
      setPhase("error_5xx");
    }
  }, [flow, fields]);

  const sortedFlags = useMemo(() => {
    if (!successPayload) {
      return [];
    }
    return sortAnalysisFlagsForDisplay(successPayload.response.analysis.flags);
  }, [successPayload]);

  const riskGroups = useMemo(() => {
    if (!successPayload) {
      return [];
    }
    return groupRisksBySeverity(successPayload.response.risks);
  }, [successPayload]);

  const copyEmailSummary = useCallback(async () => {
    if (!successPayload) {
      return;
    }
    try {
      await navigator.clipboard.writeText(
        buildLoanAssistantEmailSummary(
          successPayload.request,
          successPayload.response,
        ),
      );
      setCopiedEmailSummary(true);
      window.setTimeout(() => setCopiedEmailSummary(false), 2000);
    } catch {
      window.alert("Could not copy to clipboard.");
    }
  }, [successPayload]);

  const askDeltaLine = useMemo(() => {
    if (!successPayload) {
      return null;
    }
    const ask = successPayload.request.deal.requestedLoanAmount;
    const amt = successPayload.response.loan.amount;
    if (ask === undefined || typeof ask !== "number") {
      return "No ask entered";
    }
    if (amt === undefined) {
      return `Ask ${formatMoney(ask)} — recommended amount not available.`;
    }
    const delta = amt - ask;
    const deltaLabel =
      delta === 0
        ? "0"
        : delta > 0
          ? `+${formatMoney(delta)}`
          : formatMoney(delta);
    return `Ask ${formatMoney(ask)} vs recommended ${formatMoney(amt)} (delta ${deltaLabel})`;
  }, [successPayload]);

  /** Keep last success visible while editing until the next submit (submitting clears payload). */
  const showResults = Boolean(successPayload && phase !== "submitting");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Deal Structuring Copilot
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Structured inputs for{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            POST /api/deal/analyze
          </code>
          . Raw JSON harness:{" "}
          <a
            href="/tools/deal-analyzer"
            className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
          >
            /tools/deal-analyzer
          </a>
          .
        </p>
      </header>

      <form
        className="flex flex-col gap-6"
        data-testid="loan-assistant-form"
        onSubmit={(e) => {
          e.preventDefault();
          void runAnalyze();
        }}
      >
        <fieldset disabled={disabled} className="flex flex-col gap-4">
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Flow
          </legend>
          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="flow"
                data-testid="flow-purchase"
                checked={flow === "purchase"}
                onChange={() => onFlowChange("purchase")}
              />
              Purchase (bridge_purchase)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="flow"
                data-testid="flow-refinance"
                checked={flow === "refinance"}
                onChange={() => onFlowChange("refinance")}
              />
              Refinance (bridge_refinance)
            </label>
          </div>
        </fieldset>

        {flow === "purchase" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Purchase price <span className="text-red-600">*</span>
              </span>
              <input
                name="purchasePrice"
                data-testid="purchase-price"
                value={fields.purchasePrice}
                onChange={onField("purchasePrice")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Rehab budget
              </span>
              <input
                name="rehabBudget"
                value={fields.rehabBudget}
                onChange={onField("rehabBudget")}
                placeholder="0"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Borrowing rehab funds?
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds"
                    data-testid="borrowing-rehab-yes"
                    checked={fields.borrowingRehabFunds === "yes"}
                    onChange={() => onBorrowingRehabChange("yes")}
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds"
                    data-testid="borrowing-rehab-no"
                    checked={fields.borrowingRehabFunds === "no"}
                    onChange={() => onBorrowingRehabChange("no")}
                  />
                  No (acquisition only)
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Origination points (%)
              </span>
              <input
                name="originationPointsPercent"
                data-testid="origination-points"
                value={fields.originationPointsPercent}
                onChange={onField("originationPointsPercent")}
                placeholder="e.g. 0.65"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Loan fee (flat)
              </span>
              <input
                name="originationFlatFee"
                data-testid="origination-flat-fee"
                value={fields.originationFlatFee}
                onChange={onField("originationFlatFee")}
                placeholder="0"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                ARV <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="arv"
                data-testid="purchase-arv"
                value={fields.arv}
                onChange={onField("arv")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Requested loan amount
              </span>
              <input
                name="requestedLoanAmount"
                data-testid="purchase-requested"
                value={fields.requestedLoanAmount}
                onChange={onField("requestedLoanAmount")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Term (months)
              </span>
              <input
                name="termMonths"
                value={fields.termMonths}
                onChange={onField("termMonths")}
                inputMode="numeric"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                FICO
              </span>
              <input
                name="fico"
                value={fields.fico}
                onChange={onField("fico")}
                inputMode="numeric"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Experience tier
              </span>
              <input
                name="experienceTier"
                value={fields.experienceTier}
                onChange={onField("experienceTier")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Note rate (%) <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="noteRatePercent"
                data-testid="note-rate-percent"
                value={fields.noteRatePercent}
                onChange={onField("noteRatePercent")}
                placeholder="e.g. 9.5"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <p className="text-xs text-zinc-500 sm:col-span-2">
              Tier 1–2: advances are modeled as 90% of purchase plus 100% of rehab, capped at 75%
              of ARV. Other tiers use the standard LTC / ARV caps from policy.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Payoff amount
              </span>
              <input
                name="payoffAmount"
                data-testid="refi-payoff"
                value={fields.payoffAmount}
                onChange={onField("payoffAmount")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Requested loan amount
              </span>
              <input
                name="requestedLoanAmount"
                data-testid="refi-requested"
                value={fields.requestedLoanAmount}
                onChange={onField("requestedLoanAmount")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <p className="text-xs text-zinc-500 sm:col-span-2">
              At least one of payoff or requested amount is required (positive numbers).
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Rehab budget
              </span>
              <input
                name="rehabBudget"
                data-testid="refi-rehab-budget"
                value={fields.rehabBudget}
                onChange={onField("rehabBudget")}
                placeholder="0"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Borrowing rehab funds?
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds-refi"
                    checked={fields.borrowingRehabFunds === "yes"}
                    onChange={() => onBorrowingRehabChange("yes")}
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds-refi"
                    checked={fields.borrowingRehabFunds === "no"}
                    onChange={() => onBorrowingRehabChange("no")}
                  />
                  No (acquisition only)
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Origination points (%)
              </span>
              <input
                name="originationPointsPercent"
                value={fields.originationPointsPercent}
                onChange={onField("originationPointsPercent")}
                placeholder="e.g. 0.65"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Loan fee (flat)
              </span>
              <input
                name="originationFlatFee"
                value={fields.originationFlatFee}
                onChange={onField("originationFlatFee")}
                placeholder="0"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                As-is value <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="asIsValue"
                data-testid="refi-asis"
                value={fields.asIsValue}
                onChange={onField("asIsValue")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                ARV <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="arv"
                data-testid="refi-arv"
                value={fields.arv}
                onChange={onField("arv")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Term (months)
              </span>
              <input
                name="termMonths"
                value={fields.termMonths}
                onChange={onField("termMonths")}
                inputMode="numeric"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                FICO
              </span>
              <input
                name="fico"
                value={fields.fico}
                onChange={onField("fico")}
                inputMode="numeric"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Experience tier
              </span>
              <input
                name="experienceTier"
                value={fields.experienceTier}
                onChange={onField("experienceTier")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Note rate (%) <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="noteRatePercent"
                value={fields.noteRatePercent}
                onChange={onField("noteRatePercent")}
                placeholder="e.g. 9.5"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
        )}

        {clientHint ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
            {clientHint}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            data-testid="analyze-button"
            disabled={disabled}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {phase === "submitting" ? "Analyzing…" : "Analyze"}
          </button>
          {phase === "editing" ? (
            <span className="text-xs text-zinc-500">Editing</span>
          ) : null}
        </div>
      </form>

      {phase === "submitting" ? (
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300" role="status">
          Analyzing…
        </p>
      ) : null}

      {error4xx && phase === "error_4xx" ? (
        <div
          data-testid="error-panel"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error4xx.error ? (
            <p className="font-medium">{error4xx.error}</p>
          ) : null}
          {error4xx.code ? (
            <p className="mt-1 font-mono text-xs">code: {error4xx.code}</p>
          ) : null}
          {error4xx.issues && error4xx.issues.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {error4xx.issues.map((issue, i) => (
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

      {error5xx && phase === "error_5xx" ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error5xx}
        </div>
      ) : null}

      {showResults && successPayload ? (
        <div className="flex flex-col gap-8 border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <section data-testid="summary-strip">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Summary
              </h2>
              <button
                type="button"
                data-testid="copy-email-summary"
                onClick={() => void copyEmailSummary()}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                {copiedEmailSummary ? "Copied" : "Copy terms summary"}
              </button>
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <dt className="text-xs text-zinc-500">Acquisition loan</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.acquisitionLoanAmount !== undefined
                    ? formatMoney(successPayload.response.loan.acquisitionLoanAmount)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Rehab loan</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.rehabLoanAmount !== undefined
                    ? formatMoney(successPayload.response.loan.rehabLoanAmount)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Total loan</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatMoney(successPayload.response.loan.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">LTV</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.ltv !== undefined
                    ? `${successPayload.response.loan.ltv}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">LTC</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.ltcPercent !== undefined
                    ? `${successPayload.response.loan.ltcPercent}%`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Origination (pts / fee)</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.originationPointsPercent !== undefined
                    ? `${successPayload.response.loan.originationPointsPercent}%`
                    : "—"}{" "}
                  <span className="text-zinc-500">/</span>{" "}
                  {successPayload.response.loan.originationFlatFee !== undefined
                    ? formatMoney(successPayload.response.loan.originationFlatFee)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Pricing status</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.pricing.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Cash to close (est.)</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {formatMoney(successPayload.response.cashToClose.estimatedTotal)}
                </dd>
              </div>
            </dl>
          </section>

          <section data-testid="cash-to-close-panel">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cash to close
            </h2>
            <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
              {successPayload.response.cashToClose.items.map((item, i) => (
                <li
                  key={`${item.label}-${i}`}
                  className="flex justify-between gap-4 py-2 text-sm"
                >
                  <span>{item.label}</span>
                  <span className="tabular-nums">{formatMoney(item.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Total (estimated):{" "}
              {formatMoney(successPayload.response.cashToClose.estimatedTotal)}
            </p>
          </section>

          <section data-testid="analysis-flags-panel">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Analysis flags
            </h2>
            <ul className="mt-3 space-y-3">
              {sortedFlags.map((f) => (
                <li key={`${f.code}-${f.message}`} className="text-sm">
                  <span className="font-mono text-xs text-zinc-500">{f.code}</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{f.message}</p>
                </li>
              ))}
            </ul>
          </section>

          <section data-testid="risks-panel">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Risks
            </h2>
            <div className="mt-3 space-y-6">
              {riskGroups.map((g) => (
                <div key={g.severity}>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {g.severity}
                  </p>
                  <ul className="mt-2 space-y-4">
                    {g.risks.map((r) => (
                      <li key={`${r.code}-${r.title}`} className="text-sm">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {r.title}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                          {r.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section data-testid="secondary-details">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Details
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Term</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.termMonths === null ||
                  successPayload.response.loan.termMonths === undefined
                    ? "—"
                    : String(successPayload.response.loan.termMonths)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Product</dt>
                <dd className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.productType}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Ask vs recommended</dt>
                <dd className="text-right text-zinc-900 dark:text-zinc-100">
                  {askDeltaLine}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
