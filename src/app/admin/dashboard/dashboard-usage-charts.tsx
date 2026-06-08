"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardStackedDayRow } from "@/lib/analytics/dashboard";

function colorForStackKey(key: string, index: number): string {
  if (key === "_other") {
    return "#71717a";
  }
  const hue = (index * 47 + (key.charCodeAt(0) ?? 0) * 3) % 360;
  return `hsl(${hue} 52% 48%)`;
}

export type DashboardUsageChartsProps = {
  toolUsageByDay: { day: string; count: number }[];
  stackedUsageByDay: DashboardStackedDayRow[];
  chartStackKeys: string[];
};

export function DashboardUsageCharts({
  toolUsageByDay,
  stackedUsageByDay,
  chartStackKeys,
}: DashboardUsageChartsProps) {
  const volumeData = useMemo(
    () => [...toolUsageByDay].sort((a, b) => a.day.localeCompare(b.day)),
    [toolUsageByDay],
  );

  const mergedStackRows = useMemo(() => {
    return [...stackedUsageByDay]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map((row) => ({ day: row.day, ...row.counts }));
  }, [stackedUsageByDay]);

  // Recharts generates non-deterministic clip-path IDs and animation state during SSR,
  // which never match the client and trigger a hydration mismatch. Render the charts only
  // after mount; until then show same-height placeholders to avoid layout shift.
  const mounted = useIsMounted();

  if (volumeData.length === 0 && mergedStackRows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No events in this window to chart.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10" data-testid="dashboard-usage-charts">
      {volumeData.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Total events per day (UTC)
          </h3>
          <div className="w-full overflow-x-auto">
            {mounted ? (
              <BarChart
                width={720}
                height={288}
                data={volumeData}
                margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Events"
                  fill="#6366f1"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            ) : (
              <ChartPlaceholder width={720} height={288} />
            )}
          </div>
        </div>
      ) : null}

      {mergedStackRows.length > 0 && chartStackKeys.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Events by type (stacked, UTC days)
          </h3>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Long tail event types roll into <code className="font-mono">other types</code>.
          </p>
          <div className="w-full overflow-x-auto">
            {mounted ? (
              <BarChart
                width={720}
                height={360}
                data={mergedStackRows}
                margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-zinc-200 dark:stroke-zinc-700"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  angle={-32}
                  textAnchor="end"
                  height={56}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip />
                <Legend />
                {chartStackKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="usage"
                    fill={colorForStackKey(key, i)}
                    name={key === "_other" ? "other types" : key}
                  />
                ))}
              </BarChart>
            ) : (
              <ChartPlaceholder width={720} height={360} />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const emptySubscribe = () => () => {};

/** True only after client hydration — SSR-safe without triggering setState-in-effect. */
function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function ChartPlaceholder({ width, height }: { width: number; height: number }) {
  return (
    <div
      aria-hidden
      style={{ width, height }}
      className="max-w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900"
    />
  );
}
