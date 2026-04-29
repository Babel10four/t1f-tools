"use client";

import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { DisclosureBanner } from "@/components/tools/disclosure-banner";
import type { DealAnalyzeRequestV1 } from "@/lib/engines/deal/schemas/canonical-request";
import type { DealAnalyzeResponseV1 } from "@/lib/engines/deal/schemas/canonical-response";
import {
  TERM_SHEET_DISCLAIMER_DETAILS,
  TERM_SHEET_DISCLAIMER_SUMMARY,
} from "@/lib/tools/disclaimer-copy";
import {
  buildDealAnalyzeRequest,
  type LoanAssistantFields,
  type LoanAssistantFlow,
} from "../loan-structuring-assistant/build-deal-analyze-request";
import { useDealFormSession } from "../shared/use-deal-form-session";
import { TermSheetPreview } from "./term-sheet-preview";
import type { TermSheetLocalMetadata } from "./term-sheet-types";

const EMPTY_METADATA: TermSheetLocalMetadata = {
  internalDealLabel: "",
  counterpartyLabel: "",
  propertyLabel: "",
  preparedBy: "",
  preparedDate: "",
};

function todayLocalYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

export function TermSheetGeneratorClient() {
  const { flow, setFlow, fields, setFields, clearSession } = useDealFormSession();
  const [metadata, setMetadata] = useState<TermSheetLocalMetadata>(() => ({
    ...EMPTY_METADATA,
    preparedDate: todayLocalYmd(),
  }));
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [clientHint, setClientHint] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    response: DealAnalyzeResponseV1;
    request: DealAnalyzeRequestV1;
  } | null>(null);
  const [error4xx, setError4xx] = useState<DealAnalyzeErrorBody | null>(null);
  const [error5xx, setError5xx] = useState<string | null>(null);

  const disabled = phase === "submitting";

  const bumpToEditing = () => {
    if (phase === "success" || phase === "error_4xx" || phase === "error_5xx") {
      setPhase("editing");
    } else if (phase === "idle") {
      setPhase("editing");
    }
  };

  const onField =
    (key: keyof LoanAssistantFields) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setFields((f) => ({ ...f, [key]: e.target.value }));
      setClientHint(null);
      bumpToEditing();
    };

  const onMeta =
    (key: keyof TermSheetLocalMetadata) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setMetadata((m) => ({ ...m, [key]: e.target.value }));
      bumpToEditing();
    };

  const onFlowChange = (next: LoanAssistantFlow) => {
    setFlow(next);
    setClientHint(null);
    bumpToEditing();
  };

  const onBorrowingRehabChange = (next: "yes" | "no") => {
    setFields((f) => ({ ...f, borrowingRehabFunds: next }));
    setClientHint(null);
    bumpToEditing();
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
          "X-T1F-Tool-Key": "term_sheet",
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

  const handleClearSavedDealInputs = useCallback(() => {
    clearSession();
    setMetadata({ ...EMPTY_METADATA, preparedDate: todayLocalYmd() });
    setSuccessPayload(null);
    setError4xx(null);
    setError5xx(null);
    setClientHint(null);
    setPhase("idle");
  }, [clearSession]);

  const showPreview = Boolean(successPayload && phase !== "submitting");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Deal Sheet Builder
          </h1>
          <button
            type="button"
            data-testid="ts-clear-deal-session"
            onClick={handleClearSavedDealInputs}
            className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Clear saved deal inputs
          </button>
        </div>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Internal HTML preview from{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
            POST /api/deal/analyze
          </code>
          — indicative and non-binding. Raw JSON harness:{" "}
          <a
            href="/tools/deal-analyzer"
            className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
          >
            /tools/deal-analyzer
          </a>
          .
        </p>
        <DisclosureBanner
          summary={TERM_SHEET_DISCLAIMER_SUMMARY}
          details={TERM_SHEET_DISCLAIMER_DETAILS.map((line) => (
            <p key={line}>{line}</p>
          ))}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Deal numbers (purchase/refi fields below) are saved in this browser tab for the Cash
          to Close Calculator and other tools until you clear them or close the tab.
        </p>
      </header>

      <form
        className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
        data-testid="ts-form"
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
                data-testid="ts-flow-purchase"
                checked={flow === "purchase"}
                onChange={() => onFlowChange("purchase")}
              />
              Purchase (bridge_purchase)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="flow"
                data-testid="ts-flow-refinance"
                checked={flow === "refinance"}
                onChange={() => onFlowChange("refinance")}
              />
              Refinance (bridge_refinance)
            </label>
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            Subject property address{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <input
            name="collateralPropertyAddress"
            data-testid="ts-collateral-address"
            value={fields.collateralPropertyAddress}
            onChange={onField("collateralPropertyAddress")}
            autoComplete="street-address"
            placeholder="e.g. 100 Main St, City, ST 00000 — stored in admin analytics when you run"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Not used by the deal engine. Helps the admin dashboard list which collateral
            addresses were submitted with successful runs.
          </span>
        </label>

        {flow === "purchase" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Purchase price <span className="text-red-600">*</span>
              </span>
              <input
                name="purchasePrice"
                data-testid="ts-purchase-price"
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
                Taking rehab funds?
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds"
                    data-testid="ts-borrowing-rehab-yes"
                    checked={fields.borrowingRehabFunds === "yes"}
                    onChange={() => onBorrowingRehabChange("yes")}
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds"
                    data-testid="ts-borrowing-rehab-no"
                    checked={fields.borrowingRehabFunds === "no"}
                    onChange={() => onBorrowingRehabChange("no")}
                  />
                  No
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                ARV{" "}
                <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="arv"
                data-testid="ts-purchase-arv"
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
                data-testid="ts-purchase-requested"
                value={fields.requestedLoanAmount}
                onChange={onField("requestedLoanAmount")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Term (months){" "}
                <span className="font-normal text-zinc-500">(typical 6-18)</span>
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
                Experience tier{" "}
                <span className="font-normal text-zinc-500">(1, 2, or 3)</span>
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
                data-testid="ts-note-rate"
                value={fields.noteRatePercent}
                onChange={onField("noteRatePercent")}
                placeholder="e.g. 9.125"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Lender points (%){" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="originationPointsPercent"
                data-testid="ts-origination-points"
                value={fields.originationPointsPercent}
                onChange={onField("originationPointsPercent")}
                placeholder="e.g. 2"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Lender / loan fee ($){" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="originationFlatFee"
                data-testid="ts-origination-flat-fee"
                value={fields.originationFlatFee}
                onChange={onField("originationFlatFee")}
                placeholder="e.g. 1500"
                inputMode="decimal"
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
                data-testid="ts-refi-payoff"
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
                data-testid="ts-refi-requested"
                value={fields.requestedLoanAmount}
                onChange={onField("requestedLoanAmount")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <p className="text-xs text-zinc-500 sm:col-span-2">
              At least one of payoff or requested amount is required (positive
              numbers).
            </p>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Taking rehab funds?
              </p>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds-refi"
                    data-testid="ts-refi-borrowing-rehab-yes"
                    checked={fields.borrowingRehabFunds === "yes"}
                    onChange={() => onBorrowingRehabChange("yes")}
                  />
                  Yes
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds-refi"
                    data-testid="ts-refi-borrowing-rehab-no"
                    checked={fields.borrowingRehabFunds === "no"}
                    onChange={() => onBorrowingRehabChange("no")}
                  />
                  No
                </label>
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                As-is value{" "}
                <span className="font-normal text-zinc-500">(recommended)</span>
              </span>
              <input
                name="asIsValue"
                data-testid="ts-refi-asis"
                value={fields.asIsValue}
                onChange={onField("asIsValue")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                ARV{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="arv"
                data-testid="ts-refi-arv"
                value={fields.arv}
                onChange={onField("arv")}
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Term (months){" "}
                <span className="font-normal text-zinc-500">(typical 6-18)</span>
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
                Experience tier{" "}
                <span className="font-normal text-zinc-500">(1, 2, or 3)</span>
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
                placeholder="e.g. 9.125"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Lender points (%){" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="originationPointsPercent"
                data-testid="ts-refi-origination-points"
                value={fields.originationPointsPercent}
                onChange={onField("originationPointsPercent")}
                placeholder="e.g. 2"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Lender / loan fee ($){" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="originationFlatFee"
                data-testid="ts-refi-origination-flat-fee"
                value={fields.originationFlatFee}
                onChange={onField("originationFlatFee")}
                placeholder="e.g. 1500"
                inputMode="decimal"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
        )}

        <fieldset
          disabled={disabled}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          data-testid="ts-metadata-panel"
        >
          <legend className="px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Preview labels (not sent to analyze)
          </legend>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            These fields appear only in the HTML preview header. They are never
            included in the POST body.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Internal deal label
              </span>
              <input
                data-testid="ts-meta-internal-deal"
                value={metadata.internalDealLabel}
                onChange={onMeta("internalDealLabel")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Counterparty
              </span>
              <input
                data-testid="ts-meta-counterparty"
                value={metadata.counterpartyLabel}
                onChange={onMeta("counterpartyLabel")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Property Address
              </span>
              <input
                data-testid="ts-meta-property"
                value={metadata.propertyLabel}
                onChange={onMeta("propertyLabel")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Prepared by
              </span>
              <input
                data-testid="ts-meta-prepared-by"
                value={metadata.preparedBy}
                onChange={onMeta("preparedBy")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Prepared date
              </span>
              <input
                data-testid="ts-meta-prepared-date"
                type="date"
                value={metadata.preparedDate}
                onChange={onMeta("preparedDate")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          </div>
        </fieldset>

        {clientHint ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
            {clientHint}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            data-testid="ts-generate-button"
            disabled={disabled}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {phase === "submitting" ? "Generating preview…" : "Generate preview"}
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
          data-testid="ts-submitting"
        >
          Generating preview…
        </p>
      ) : null}

      {error4xx && phase === "error_4xx" ? (
        <div
          data-testid="ts-error-4xx"
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
          data-testid="ts-error-5xx"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
          role="alert"
        >
          {error5xx}
        </div>
      ) : null}

      {showPreview && successPayload ? (
        <TermSheetPreview
          metadata={metadata}
          request={successPayload.request}
          response={successPayload.response}
        />
      ) : null}
    </div>
  );
}
