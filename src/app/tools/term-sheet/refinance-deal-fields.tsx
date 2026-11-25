import { useState } from "react";
import type { LoanAssistantFields } from "../loan-structuring-assistant/build-deal-analyze-request";
import {
  fieldError, normalizeDollars, normalizedRefinanceFields, numberOrNull, sumMoney,
  type RefinanceNumberField,
} from "./refinance-entry";

export { normalizedRefinanceFields, validateRefinanceFields } from "./refinance-entry";

type Props = {
  fields: LoanAssistantFields;
  disabled: boolean;
  onChange: (patch: Partial<LoanAssistantFields>) => void;
};

type RehabChoice = "complete" | "financed" | "self-funded";
const currency = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const inputClass = "w-full rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-base text-[var(--text-primary)] shadow-sm focus:border-[var(--brand)] focus:outline-2 focus:outline-[var(--brand)]";
const headingClass = "text-base font-semibold text-[var(--text-primary)]";

function Input({ label, name, value, testId, onChange, hint, error, currencyInput = false, type = "text" }: {
  label: string;
  name: string;
  value: string;
  testId?: string;
  onChange: (raw: string) => void;
  hint?: string;
  error?: string;
  currencyInput?: boolean;
  type?: "date" | "text";
}) {
  const id = "ts-refi-field-" + name;
  // Keep separators under the cursor while editing; the shared deal stores a plain number.
  const [typed, setTyped] = useState<{ display: string; value: string } | null>(null);
  const display = typed?.value === value ? typed.display : value;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--text-primary)]">{label}</label>
      <input
        id={id} name={name} type={type} data-testid={testId} value={display}
        inputMode={type === "text" && name !== "experienceTier" ? "decimal" : undefined}
        onChange={(event) => {
          const raw = event.target.value;
          const next = currencyInput ? normalizeDollars(raw) : raw;
          if (currencyInput) setTyped({ display: raw, value: next });
          onChange(next);
        }}
        onBlur={() => setTyped(null)}
        aria-invalid={error ? true : undefined} aria-describedby={error || hint ? id + "-help" : undefined}
        className={inputClass}
      />
      {error || hint ? <p id={id + "-help"} className={"text-xs " + (error ? "text-red-700" : "text-[var(--text-muted)]")}>{error || hint}</p> : null}
    </div>
  );
}

function MoneyRow({ label, amount, prominent }: { label: string; amount: number | null; prominent?: boolean }) {
  return (
    <div className={"flex items-baseline justify-between gap-4 py-1.5 " + (prominent ? "border-t border-[var(--border-subtle)] font-semibold" : "")}>
      <dt>{label}</dt><dd className="shrink-0 tabular-nums">{amount === null ? "—" : currency.format(amount)}</dd>
    </div>
  );
}

export function RefinanceDealFields({ fields, disabled, onChange }: Props) {
  // Existing drafts store the total commitment. Reopen them exactly as entered.
  const [totalMode, setTotalMode] = useState(() => Boolean(fields.requestedLoanAmount.trim()));
  const [selfFunded, setSelfFunded] = useState(false);
  const [splitEdit, setSplitEdit] = useState<{ raw: string; total: string; rehab: string } | null>(null);
  const normalized = normalizedRefinanceFields(fields);
  const hasSelfFundedWork = selfFunded || Number(normalized.rehabBudget) !== 0;
  const choice: RehabChoice = fields.borrowingRehabFunds === "yes" ? "financed"
    : hasSelfFundedWork ? "self-funded" : "complete";
  const seasoned = fields.refinanceScenario === "refinance_seasoned";
  const rehabText = choice === "financed" ? normalized.rehabBudget : "";
  const holdback = !rehabText.trim() ? 0 : numberOrNull(rehabText);
  const requested = numberOrNull(normalized.requestedLoanAmount);
  const payoff = numberOrNull(normalized.payoffAmount);
  const upfront = requested !== null && holdback !== null && requested >= holdback ? sumMoney(requested, -holdback) : null;
  const initialText = splitEdit && splitEdit.total === fields.requestedLoanAmount && splitEdit.rehab === rehabText
    ? splitEdit.raw : upfront === null ? "" : String(upfront);
  const canSplit = !fields.requestedLoanAmount.trim() || upfront !== null;

  const updateSplit = (raw: string, nextRehab: string, patch: Partial<LoanAssistantFields> = {}) => {
    const advance = numberOrNull(raw);
    const budget = nextRehab.trim() ? numberOrNull(nextRehab) : 0;
    let total = raw;
    if (advance !== null && budget !== null) total = String(sumMoney(advance, budget));
    setSplitEdit({ raw, total, rehab: nextRehab });
    onChange({ ...patch, requestedLoanAmount: total });
  };

  const chooseRehab = (next: RehabChoice) => {
    const patch: Partial<LoanAssistantFields> = { borrowingRehabFunds: next === "financed" ? "yes" : "no" };
    if (next !== "financed") patch.refinanceScenario = "";
    if (next === "complete") patch.rehabBudget = "";
    setSelfFunded(next === "self-funded");
    if (totalMode) onChange(patch);
    else updateSplit(initialText, next === "financed" ? normalized.rehabBudget : "", patch);
  };

  const changeAmount = (name: RefinanceNumberField, value: string) => {
    if (!totalMode && choice === "financed" && name === "rehabBudget") {
      updateSplit(initialText, value, { rehabBudget: value });
      return;
    }
    onChange({ [name]: value });
  };

  function amount(name: RefinanceNumberField, label: string, testId: string, hint?: string, currencyInput = true) {
    return <Input name={name} label={label} testId={testId} value={fields[name]} hint={hint}
      currencyInput={currencyInput} error={fieldError(name, normalized[name])}
      onChange={(value) => changeAmount(name, value)} />;
  }

  const feeSummary = [
    fields.noteRatePercent && fields.noteRatePercent + "% rate",
    fields.originationPointsPercent && fields.originationPointsPercent + "% points",
    numberOrNull(normalized.originationFlatFee) !== null && currency.format(Number(normalized.originationFlatFee)) + " fee",
    fields.termMonths && fields.termMonths + " months",
    fields.closingDate && "Closing " + fields.closingDate,
  ].filter(Boolean).join(" · ");
  const difference = payoff !== null && upfront !== null ? sumMoney(payoff, -upfront) : null;
  const arvInput = amount("arv", "After-repair value ($)" + (seasoned ? " (required)" : " (optional)"), "ts-refi-arv");

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <section id="refi-scenario" tabIndex={-1} className="space-y-3">
        <fieldset>
          <legend className={headingClass}>Does the borrower need funds for future rehab?</legend>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {([
              ["complete", "No future rehab", "ts-refi-borrowing-rehab-no"],
              ["financed", "Finance the full rehab budget", "ts-refi-borrowing-rehab-yes"],
              ["self-funded", "Borrower will pay for rehab", "ts-refi-borrower-funded"],
            ] as const).map(([option, label, testId]) => (
              <label key={option} className={"flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium " +
                (option === choice ? "border-[var(--brand)] bg-[var(--surface-soft)]" : "border-[var(--border-subtle)]")}>
                <input type="radio" name="refiRehabChoice" data-testid={testId} checked={option === choice} onChange={() => chooseRehab(option)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {(choice === "financed" || seasoned) && (
          <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="refinanceScenario" checked={seasoned} data-testid="ts-refi-seasoned-scenario"
                aria-describedby="ts-refi-seasoned-help"
                onChange={(e) => onChange({ refinanceScenario: e.target.checked ? "refinance_seasoned" : "" })} />
              Seasoned refinance with rehab (Tier 0/1)
            </label>
            <p id="ts-refi-seasoned-help" className="mt-1 pl-5 text-xs text-[var(--text-muted)]">
              Select only after confirming the borrower has held the property for more than 180 days.
              The 70% ARV cap applies to the total loan, including the full rehab holdback.
            </p>
          </div>
        )}
        <details className="text-xs text-[var(--text-muted)]">
          <summary className="w-fit cursor-pointer font-medium">Is this a delayed purchase?</summary>
          <p className="mt-1">If the borrower is seeking reimbursement for a recent purchase, confirm the applicable delayed purchase terms with the pricing team.</p>
        </details>
      </section>

      <section id="refi-funding" tabIndex={-1} className="border-t border-[var(--border-subtle)] pt-5">
        <h2 className={headingClass}>Where does the money go?</h2>
        <div className="mt-3 grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            {amount("payoffAmount", "Existing loan payoff ($)", "ts-refi-payoff", "Balance owed to the current lender.")}
            {choice !== "complete" && amount("rehabBudget", choice === "financed" ? "Future rehab draws ($)" : "Borrower-funded rehab budget ($)", "ts-refi-rehab",
              choice === "financed" ? "T1F reserves the full budget for draws." : "The borrower covers this amount separately.")}
            {totalMode ? amount("requestedLoanAmount", "Total loan requested ($)", "ts-refi-requested", "Includes any financed rehab. Leave blank to let the engine size from the payoff.") :
              <Input label="Loan funds requested at closing ($)" name="initialAdvance" testId="ts-refi-initial" value={initialText}
                currencyInput onChange={(value) => updateSplit(value, rehabText)}
                error={initialText.trim() && numberOrNull(initialText) === null ? "Enter a non-negative amount for funds at closing." : undefined}
                hint="Enter the amount before rehab draws, or leave blank to size from the payoff." />}
            <button type="button" className="block text-sm font-medium text-[var(--brand)] underline underline-offset-2 disabled:text-[var(--text-muted)]"
              disabled={totalMode && !canSplit} data-testid={totalMode ? "ts-refi-split-mode" : "ts-refi-total-mode"}
              onClick={() => { setSplitEdit(null); setTotalMode(!totalMode); }}>
              {totalMode ? "Enter funds at closing instead" : "Enter the total loan instead"}
            </button>
          </div>
          <aside className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4" data-testid="ts-refi-request-breakdown">
            <h3 className="text-sm font-semibold">Borrower’s request</h3>
            <dl className="mt-2 text-sm">
              <MoneyRow label="Funds at closing" amount={upfront} />
              <MoneyRow label="Future rehab draws" amount={holdback} />
              <MoneyRow label="Total requested" amount={requested} prominent />
              {difference !== null && <MoneyRow label={difference < 0 ? "Excess over payoff, before costs" : "Payoff shortfall, before costs"} amount={Math.abs(difference)} />}
            </dl>
            {requested !== null && holdback !== null && requested < holdback &&
              <p className="mt-2 text-xs text-amber-800">The requested loan is smaller than the full rehab holdback.</p>}
            <p className="mt-2 text-xs text-[var(--text-muted)]">Review the preview for sized loan funds and estimated cash to close.</p>
          </aside>
        </div>
      </section>

      <section id="refi-property" tabIndex={-1} className="border-t border-[var(--border-subtle)] pt-5">
        <h2 className={headingClass}>Property and borrower</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {amount("asIsValue", "Current as-is value ($)", "ts-refi-asis", "Estimated value in its current condition.")}
          {choice === "complete" && !seasoned ? (
            <details className="self-center text-sm">
              <summary className="cursor-pointer text-[var(--brand)]">
                {fields.arv ? "After-repair value entered: " + fields.arv : "Add an after-repair value"}
              </summary>
              <div className="mt-2">{arvInput}</div>
            </details>
          ) : arvInput}
          <Input name="experienceTier" label={"Experience tier" + (seasoned ? " (0 or 1 required)" : " (optional)")} value={fields.experienceTier}
            onChange={(value) => onChange({ experienceTier: value })} />
          {amount("fico", "FICO (optional)", "ts-refi-fico", undefined, false)}
        </div>
      </section>

      <details id="refi-pricing" tabIndex={-1} className="rounded-xl border border-[var(--border-subtle)] p-4">
        <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Pricing and fees
          <span className="ml-2 inline-block text-xs font-normal text-[var(--text-muted)]">{feeSummary || "Add rate, fees, term and closing date"}</span>
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {amount("noteRatePercent", "Note rate (%)", "ts-refi-note-rate", undefined, false)}
          {amount("originationPointsPercent", "Lender points (%)", "ts-refi-origination-points", undefined, false)}
          {amount("originationFlatFee", "Flat lender fee ($)", "ts-refi-origination-flat-fee")}
          {amount("termMonths", "Term (months)", "ts-refi-term", undefined, false)}
          <Input name="closingDate" label="Closing date" type="date" testId="ts-closing-date" value={fields.closingDate}
            onChange={(value) => onChange({ closingDate: value })} hint="Used to estimate interest due at closing." />
        </div>
      </details>
    </fieldset>
  );
}
