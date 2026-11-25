"use client";

import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { DisclosureBanner } from "@/components/tools/disclosure-banner";
import { ToolPageHeader } from "@/components/tools/tool-page-header";
import { Button } from "@/components/ui/button";
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
import {
  purchaseRequestedLoanSuggestedString,
  purchaseRequestedLoanSuggestionDescription,
  type PurchaseSuggestionPolicy,
} from "../loan-structuring-assistant/requested-loan-suggest";
import { useDealFormSession } from "../shared/use-deal-form-session";
import { todayLocalYmd } from "../shared/closing-date";
import { PricingComparisonPanel } from "./pricing-comparison-panel";
import { RefinanceDealFields, normalizedRefinanceFields, validateRefinanceFields } from "./refinance-deal-fields";
import { TermSheetPreview } from "./term-sheet-preview";
import type { TermSheetLocalMetadata } from "./term-sheet-types";

const EMPTY_METADATA: TermSheetLocalMetadata = {
  internalDealLabel: "",
  counterpartyLabel: "",
  propertyLabel: "",
  preparedBy: "",
  preparedDate: "",
};

const documentFields = [
  { key: "counterpartyLabel", label: "Borrower or borrowing entity", testId: "ts-meta-counterparty" },
  { key: "preparedBy", label: "Prepared by", testId: "ts-meta-prepared-by" },
  { key: "preparedDate", label: "Prepared date", testId: "ts-meta-prepared-date" },
  { key: "internalDealLabel", label: "Deal label on the sheet", testId: "ts-meta-internal-deal" },
  { key: "propertyLabel", label: "Property address override", testId: "ts-meta-property" },
] as const;

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

function focusGeneratedReview(section: HTMLElement | null) {
  section?.focus();
}

export function TermSheetGeneratorClient({ calculator }: { calculator?: PurchaseSuggestionPolicy }) {
  const { flow, setFlow, fields, setFields, resumedDraft, clearSession } = useDealFormSession();
  const [metadata, setMetadata] = useState<TermSheetLocalMetadata>(() => ({
    ...EMPTY_METADATA,
    preparedDate: todayLocalYmd(),
  }));
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [dealNumber, setDealNumber] = useState(0);
  const [clientHint, setClientHint] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    response: DealAnalyzeResponseV1;
    request: DealAnalyzeRequestV1;
    fields: LoanAssistantFields;
  } | null>(null);
  const [error4xx, setError4xx] = useState<DealAnalyzeErrorBody | null>(null);
  const [error5xx, setError5xx] = useState<string | null>(null);

  const disabled = phase === "submitting";

  /** Last illustrative suggested total whenever driving inputs ran; excludes manual requested edits. */
  const lastSuggestedPurchaseRequestedRef = useRef<string | null>(null);

  const applyPurchaseRequestedLoanSuggestion = (
    nextFields: LoanAssistantFields,
    nextFlow: LoanAssistantFlow,
  ): LoanAssistantFields => {
    if (nextFlow !== "purchase") {
      lastSuggestedPurchaseRequestedRef.current = null;
      return nextFields;
    }

    const next = purchaseRequestedLoanSuggestedString(nextFields, calculator);
    const cur = nextFields.requestedLoanAmount.trim();
    const prevSuggestion = lastSuggestedPurchaseRequestedRef.current;
    if (next === null) {
      lastSuggestedPurchaseRequestedRef.current = null;
      return prevSuggestion !== null && cur === prevSuggestion
        ? { ...nextFields, requestedLoanAmount: "" }
        : nextFields;
    }

    const stillTrackingSuggestion =
      cur === "" ||
      (prevSuggestion !== null && cur === prevSuggestion);

    lastSuggestedPurchaseRequestedRef.current = next;

    if (stillTrackingSuggestion && cur !== next) {
      return { ...nextFields, requestedLoanAmount: next };
    }
    return nextFields;
  };

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
      const value = e.target.value;
      setFields((f) => {
        const nextFields = { ...f, [key]: value };
        return key === "requestedLoanAmount"
          ? nextFields
          : applyPurchaseRequestedLoanSuggestion(nextFields, flow);
      });
      setClientHint(null);
      bumpToEditing();
    };

  const onMeta =
    (key: keyof TermSheetLocalMetadata) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setMetadata((m) => ({ ...m, [key]: e.target.value }));
    };

  const onFlowChange = (next: LoanAssistantFlow) => {
    setFlow(next);
    setFields((f) => applyPurchaseRequestedLoanSuggestion(
      next === "purchase" ? { ...f, refinanceScenario: "" } : f,
      next,
    ));
    setClientHint(null);
    bumpToEditing();
  };

  const onBorrowingRehabChange = (next: "yes" | "no") => {
    setFields((f) =>
      applyPurchaseRequestedLoanSuggestion({ ...f, borrowingRehabFunds: next }, flow),
    );
    setClientHint(null);
    bumpToEditing();
  };

  const runAnalyze = useCallback(async () => {
    if (flow === "refinance") {
      const issue = validateRefinanceFields(fields);
      if (issue) {
        setClientHint(issue);
        setPhase("editing");
        return;
      }
    }
    const built = buildDealAnalyzeRequest(flow, flow === "refinance" ? normalizedRefinanceFields(fields) : fields);
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
          fields,
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

  function handleClearSavedDealInputs() {
    clearSession();
    setDealNumber((previous) => previous + 1);
    lastSuggestedPurchaseRequestedRef.current = null;
    setMetadata({ ...EMPTY_METADATA, preparedDate: todayLocalYmd() });
    setSuccessPayload(null);
    setError4xx(null);
    setError5xx(null);
    setClientHint(null);
    setPhase("idle");
  }

  // The export must always describe the inputs that produced the engine response,
  // including the closing date used for the per-diem calculation.
  const previewIsCurrent = successPayload !== null
    && successPayload.request.deal.purpose === flow
    && (Object.keys(fields) as (keyof LoanAssistantFields)[]).every(
      (key) => (fields[key] ?? "") === (successPayload.fields[key] ?? ""),
    );
  const needsUpdate = successPayload !== null && !previewIsCurrent;
  const documentDetails = (
    <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3" open={flow === "purchase" ? true : undefined}>
      <summary className="cursor-pointer text-sm font-semibold">Document details</summary>
      <fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2" data-testid="ts-metadata-panel">
        <legend className="sr-only">Details on the term sheet</legend>
        {documentFields.map(({ key, label, testId }) => (
          <label key={key} className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{label}</span>
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              type={key === "preparedDate" ? "date" : "text"}
              data-testid={testId}
              value={metadata[key]}
              onChange={onMeta(key)}
              placeholder={key === "propertyLabel" ? fields.collateralPropertyAddress || "Use subject property address" : undefined}
            />
          </label>
        ))}
      </fieldset>
    </details>
  );

  return (
    <div className="flex flex-col gap-8">
      <ToolPageHeader
        href="/tools/term-sheet"
        collapseOverview={flow === "refinance"}
        actions={
          <Button
            variant="secondary"
            size="sm"
            data-testid="ts-clear-deal-session"
            disabled={disabled}
            onClick={handleClearSavedDealInputs}
          >
            Start new deal
          </Button>
        }
        disclosure={
          <div className="flex flex-col gap-2">
            <DisclosureBanner
              summary={TERM_SHEET_DISCLAIMER_SUMMARY}
              details={TERM_SHEET_DISCLAIMER_DETAILS.map((line) => (
                <p key={line}>{line}</p>
              ))}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {resumedDraft
                ? `Resumed ${resumedDraft.flow} draft${resumedDraft.address ? ` for ${resumedDraft.address}` : ""} from this tab.`
                : "Deal inputs are saved in this tab until you start a new deal or close the tab."}
            </p>
          </div>
        }
      />

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
            What is the borrower doing?
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
              Buying a property
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="flow"
                data-testid="ts-flow-refinance"
                checked={flow === "refinance"}
                onChange={() => onFlowChange("refinance")}
              />
              Refinancing a property they own
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
            placeholder="e.g. 100 Main St, City, ST 00000"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Optional — appears on the printed deal sheet when provided.
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
                data-testid="ts-purchase-rehab"
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
                  Yes — 100% of rehab
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="borrowingRehabFunds"
                    data-testid="ts-borrowing-rehab-no"
                    checked={fields.borrowingRehabFunds === "no"}
                    onChange={() => onBorrowingRehabChange("no")}
                  />
                  No — 0% of rehab
                </label>
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Rehab funding is all or none. When funding rehab, the full budget
                is reserved first. If the ARV cap limits the loan, purchase funds
                decrease instead. A loan that cannot cover the full rehab budget
                cannot be quoted with rehab funding.
              </p>
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
              <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {purchaseRequestedLoanSuggestionDescription(fields, calculator)}
              </span>
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
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Optional — not required for an indicative term sheet.
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                Experience tier{" "}
                <span className="font-normal text-zinc-500">(1, 2, 3, or 4)</span>
              </span>
              <input
                name="experienceTier"
                value={fields.experienceTier}
                onChange={onField("experienceTier")}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Optional — not required for an indicative term sheet.
              </span>
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
          <RefinanceDealFields
            fields={fields}
            disabled={disabled}
            onChange={(patch) => {
              setFields((previous) => ({ ...previous, ...patch }));
              setClientHint(null);
              bumpToEditing();
            }}
          />
        )}

        {flow === "purchase" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              Closing date
            </span>
            <input
              name="closingDate"
              data-testid="ts-closing-date"
              type="date"
              value={fields.closingDate}
              onChange={onField("closingDate")}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Drives the per-diem and partial-month interest in the cash-to-close estimate.
              Defaults to today; shared with the Cash to Close calculator for this tab.
            </span>
          </label>
        )}

        {flow === "purchase" ? documentDetails : null}

        {clientHint ? (
          <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
            {clientHint}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" data-testid="ts-generate-button" disabled={disabled}>
            {phase === "submitting" ? "Generating preview…" : needsUpdate ? "Update preview" : "Generate preview"}
          </Button>
          {needsUpdate ? (
            <span className="text-sm font-medium text-amber-800" role="status">Terms changed. Update the preview to copy or download the new figures.</span>
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

      {previewIsCurrent && successPayload ? (
        <section
          aria-label="Generated term sheet"
          className="flex scroll-mt-3 flex-col gap-3"
          tabIndex={-1}
          ref={focusGeneratedReview}
        >
          {flow === "refinance" ? documentDetails : null}
          <TermSheetPreview
            metadata={{ ...metadata, propertyLabel: metadata.propertyLabel.trim() || successPayload.fields.collateralPropertyAddress.trim() }}
            request={successPayload.request}
            response={successPayload.response}
            closingDate={successPayload.fields.closingDate}
          />
        </section>
      ) : null}

      <details className="rounded-xl border border-zinc-200 bg-white p-4" open={flow === "purchase" ? true : undefined}>
        <summary className="cursor-pointer text-sm font-semibold">Compare another offer</summary>
        <div className="mt-4"><PricingComparisonPanel key={dealNumber} /></div>
      </details>
    </div>
  );
}
