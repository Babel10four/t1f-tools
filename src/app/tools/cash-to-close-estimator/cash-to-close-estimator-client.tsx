"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  buildDealAnalyzeRequest,
  type LoanAssistantFields,
  type LoanAssistantFlow,
} from "../loan-structuring-assistant/build-deal-analyze-request";
import {
  formatMoney,
  groupRisksBySeverity,
} from "../loan-structuring-assistant/display-helpers";

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

/**
 * Cash-to-close-first UI (TICKET-005). Flags preserve **server order** (no client-side resort).
 */
export function CashToCloseEstimatorClient() {
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

  const runEstimate = useCallback(async () => {
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
          "X-T1F-Tool-Key": "cash_to_close_estimator",
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

  const riskGroups = useMemo(() => {
    if (!successPayload) {
      return [];
    }
    return groupRisksBySeverity(successPayload.response.risks);
  }, [successPayload]);

  const showResults = Boolean(successPayload && phase !== "submitting");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Cash to Close Calculator
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Estimate cash needed at closing from your deal inputs. For discussion only —
          not a final settlement statement, HUD-1, or Closing Disclosure.
        </p>
      </header>

      <form
        className="flex flex-col gap-6"
        data-testid="ctc-form"
        onSubmit={(e) => {
          e.preventDefault();
          void runEstimate();
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
                name="ctc-flow"
                data-testid="ctc-flow-purchase"
                checked={flow === "purchase"}
                onChange={() => onFlowChange("purchase")}
              />
              Purchase (bridge_purchase)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="ctc-flow"
                data-testid="ctc-flow-refinance"
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
                data-testid="ctc-purchase-price"
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
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                ARV <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="arv"
                data-testid="ctc-purchase-arv"
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
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Payoff amount
              </span>
              <input
                name="payoffAmount"
                data-testid="ctc-refi-payoff"
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
                data-testid="ctc-refi-requested"
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
                As-is value <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="asIsValue"
                data-testid="ctc-refi-asis"
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
                data-testid="ctc-refi-arv"
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
            data-testid="ctc-estimate-button"
            disabled={disabled}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {phase === "submitting" ? "Estimating…" : "Estimate Cash"}
          </button>
          {phase === "editing" ? (
            <span className="text-xs text-zinc-500">Editing</span>
          ) : null}
        </div>
      </form>

      {phase === "submitting" ? (
        <p
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          role="status"
          data-testid="ctc-submitting"
        >
          Estimating…
        </p>
      ) : null}

      {error4xx && phase === "error_4xx" ? (
        <div
          data-testid="ctc-error-4xx"
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
          data-testid="ctc-error-5xx"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error5xx}
        </div>
      ) : null}

      {showResults && successPayload ? (
        <div
          data-testid="ctc-results"
          className="flex flex-col gap-8 border-t border-zinc-200 pt-8 dark:border-zinc-800"
        >
          <section data-testid="ctc-cash-summary-strip">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cash summary
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Cash to close status</dt>
                <dd
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  data-testid="ctc-cash-status"
                >
                  {successPayload.response.cashToClose.status}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Estimated total</dt>
                <dd
                  className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
                  data-testid="ctc-cash-estimated-total"
                >
                  {successPayload.response.cashToClose.estimatedTotal === null
                    ? "Not returned"
                    : formatMoney(successPayload.response.cashToClose.estimatedTotal)}
                </dd>
              </div>
            </dl>
          </section>

          <section data-testid="ctc-cash-line-items">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Cash to close line items
            </h2>
            {successPayload.response.cashToClose.items.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                No line items were returned.
              </p>
            ) : (
              <ul
                className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800"
                data-testid="ctc-cash-lines-list"
              >
                {successPayload.response.cashToClose.items.map((item, i) => (
                  <li
                    key={`${item.label}-${i}`}
                    data-line-index={i}
                    className="flex justify-between gap-4 py-2 text-sm"
                  >
                    <span>{item.label}</span>
                    <span className="tabular-nums">{formatMoney(item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section data-testid="ctc-analysis-context">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Analysis context
            </h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              Analysis status:{" "}
              <span className="font-mono text-xs">
                {successPayload.response.analysis.status}
              </span>
            </p>
            <ul className="mt-3 space-y-3">
              {successPayload.response.analysis.flags.map((f) => (
                <li key={`${f.code}-${f.message}`} className="text-sm">
                  <span className="font-mono text-xs text-zinc-500">{f.code}</span>
                  <p className="text-zinc-900 dark:text-zinc-100">{f.message}</p>
                </li>
              ))}
            </ul>
          </section>

          <section data-testid="ctc-risks-panel">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Risks / next actions
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

          <section data-testid="ctc-secondary-context">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Secondary context
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Loan amount</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {formatMoney(successPayload.response.loan.amount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">LTV</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.loan.ltv !== undefined
                    ? `${successPayload.response.loan.ltv}%`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Pricing status</dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {successPayload.response.pricing.status}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Term (months)</dt>
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
            </dl>
          </section>
        </div>
      ) : null}
    </div>
  );
}
