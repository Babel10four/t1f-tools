import Link from "next/link";
import {
  DASHBOARD_WINDOW_PRESETS,
  type DashboardKpis,
} from "@/lib/analytics/dashboard";

type Props = {
  kpis: DashboardKpis;
};

function AddressTable({
  title,
  rows,
  emptyHint,
  showRuralResult,
  testId,
}: {
  title: string;
  rows: DashboardKpis["termSheetCollateralAddresses"];
  emptyHint: string;
  showRuralResult?: boolean;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{emptyHint}</p>
      ) : (
        <div
          className="mt-2 max-h-72 overflow-y-auto rounded-md border border-zinc-100 dark:border-zinc-800"
          data-testid={testId}
        >
          <table className="w-full min-w-[200px] text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                  Time (UTC)
                </th>
                <th className="px-2 py-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                  Address
                </th>
                <th className="px-2 py-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                  Role
                </th>
                {showRuralResult ? (
                  <th className="px-2 py-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                    Result
                  </th>
                ) : null}
                <th className="px-2 py-1.5 font-medium text-zinc-600 dark:text-zinc-300">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.createdAtIso}-${i}-${row.address.slice(0, 24)}`}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-2 py-1.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {row.createdAtIso.slice(0, 19).replace("T", " ")}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-900 dark:text-zinc-100">
                    {row.address}
                  </td>
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400">{row.role}</td>
                  {showRuralResult ? (
                    <td className="px-2 py-1.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                      {row.ruralResult ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function AdminDashboardView({ kpis }: Props) {
  const { totals, windowDays, dbAvailable } = kpis;
  if (!dbAvailable) {
    return (
      <div className="flex flex-col gap-4" data-testid="admin-dashboard">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p
          className="text-sm text-amber-800 dark:text-amber-200"
          data-testid="admin-dashboard-db-unavailable"
        >
          Analytics database is unavailable (set <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">DATABASE_URL</code>{" "}
          and apply migrations including <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">drizzle/0003_events.sql</code>
          ). Event logging and KPIs require Postgres.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="admin-dashboard">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Shared-password sessions — no named users. Counts and address lists use UTC
          timestamps from the <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">events</code> table. See README if analytics writes fail silently.
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Reporting window
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
          Current view: <strong>{kpis.windowDays}</strong> calendar days rolling from now
          (UTC).
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Presets approximate days / weeks / months. All charts below use the same window.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DASHBOARD_WINDOW_PRESETS.map((d) => {
            const active = kpis.windowDays === d;
            const label =
              d === 7
                ? "7 days"
                : d === 30
                  ? "30 days (~1 mo)"
                  : d === 90
                    ? "90 days (~3 mo)"
                    : "180 days (~6 mo)";
            return (
              <Link
                key={d}
                href={`/admin/dashboard?window=${d}`}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--brand)] bg-[var(--brand-muted)] text-[var(--brand)]"
                    : "border-zinc-300 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                }`}
                aria-current={active ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Deal Sheet &amp; cash-to-close usage
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Successful runs in the selected window. Property addresses appear when users
          enter the optional &quot;Subject property address&quot; field on the Term Sheet or
          Cash to Close tools (logged on the server).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard
            label="Term Sheet (Deal Sheet) builder runs"
            value={totals.termSheetPreviewRuns}
            hint="deal_analyze_run + tool_key term_sheet — preview / HTML path"
          />
          <KpiCard
            label="Cash-to-close estimator runs"
            value={totals.cashToCloseRuns}
            hint="cash_to_close_run + tool_key cash_to_close_estimator (legacy cash_to_close counted)"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Logged property addresses
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <AddressTable
            title="Term Sheet builder (collateral address)"
            rows={kpis.termSheetCollateralAddresses}
            emptyHint="No successful term-sheet runs with a logged address in this window."
            testId="admin-address-term-sheet"
          />
          <AddressTable
            title="Cash-to-close (collateral address)"
            rows={kpis.cashToCloseCollateralAddresses}
            emptyHint="No cash-to-close events with a logged address in this window."
            testId="admin-address-cash-to-close"
          />
        </div>
        <div className="mt-6">
          <AddressTable
            title="Rural Checker (street address submitted)"
            rows={kpis.ruralCheckAddresses}
            emptyHint="No rural checks with addressLine in metadata in this window."
            showRuralResult
            testId="admin-address-rural"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Tool &amp; API activity
        </h2>
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Analyze-backed tools are counted as <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">deal_analyze_run</code>{" "}
          (or <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">pricing_check_run</code> /{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">cash_to_close_run</code>) plus a specific{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px] dark:bg-zinc-800">tool_key</code> — not as one combined “all analyze” total.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Deal Structuring Copilot runs"
            value={totals.loanStructuringAssistantRuns}
            hint="deal_analyze_run + tool_key loan_structuring_assistant"
          />
          <KpiCard
            label="Deal Analyzer runs"
            value={totals.dealAnalyzerRuns}
            hint="deal_analyze_run + tool_key deal_analyzer"
          />
          <KpiCard
            label="Pricing checks"
            value={totals.pricingCheckRuns}
            hint="pricing_check_run + tool_key pricing_calculator"
          />
          <KpiCard label="Rural checks" value={totals.ruralCheckRuns} />
          <KpiCard label="Credit copilot" value={totals.creditCopilotQuestions} />
          <KpiCard
            label="Term sheet terms API events (reserved)"
            value={totals.termSheetTermsApiEvents}
            hint="term_sheet_generated — POST /api/deal/terms; not the preview KPI"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Admin &amp; config
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label="Document uploads" value={totals.documentUploads} />
          <KpiCard label="Document publishes" value={totals.documentPublishes} />
          <KpiCard label="Rule set updates" value={totals.ruleSetUpdates} />
          <KpiCard
            label="Errors (window)"
            value={kpis.errorsInWindow}
            hint="status=error in events"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Published policy / config (CONTENT-001 / CONFIG-001)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard
            label="Published documents"
            value={kpis.publishedDocumentCount}
          />
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Published rule sets
            </div>
            {kpis.publishedRuleSets.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">None</p>
            ) : (
              <ul
                className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm text-zinc-800 dark:text-zinc-200"
                data-testid="published-rule-sets-list"
              >
                {kpis.publishedRuleSets.map((r) => (
                  <li key={`${r.ruleType}-${r.versionLabel}`}>
                    <span className="font-mono text-xs">{r.ruleType}</span> —{" "}
                    {r.versionLabel}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Tool usage by day (UTC)
        </h2>
        <div
          className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
          data-testid="tool-usage-by-day"
        >
          <table className="w-full min-w-[240px] text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                  Day
                </th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                  Events
                </th>
              </tr>
            </thead>
            <tbody>
              {kpis.toolUsageByDay.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-zinc-500">
                    No events in window
                  </td>
                </tr>
              ) : (
                kpis.toolUsageByDay.map((row) => (
                  <tr
                    key={row.day}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{row.day}</td>
                    <td className="px-3 py-2 tabular-nums">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Events by tool_key
        </h2>
        <div
          className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700"
          data-testid="tool-usage-by-tool"
        >
          <table className="w-full min-w-[240px] text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80">
              <tr>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                  tool_key
                </th>
                <th className="px-3 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                  Events
                </th>
              </tr>
            </thead>
            <tbody>
              {kpis.toolUsageByToolKey.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-zinc-500">
                    No keyed events
                  </td>
                </tr>
              ) : (
                kpis.toolUsageByToolKey.map((row) => (
                  <tr
                    key={String(row.toolKey)}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.toolKey ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
