'use client';

/**
 * PharosGRC Design System — historical trend chart with an accessible
 * tabular equivalent (T059, data-model.md §2 `indicator_measurements`).
 *
 * ## F-28, paid once already — read before touching this file
 *
 * `docs/deferred-findings.md` F-28: the dashboard's own charts once passed
 * an accessibility scan with "zero violations" only because the scan ran
 * against a visually-hidden data table that mounts before the chart's
 * `<svg>` does — it measured a screen whose charts had not rendered yet.
 * This component avoids that failure mode structurally, not by convention:
 * the accessible `<table>` below and the `<LineChart>` above are both built
 * from the exact same `points`/`seriesDefs` props in the same render pass,
 * so there is no window where one exists and the other does not, and no way
 * for the two to drift out of sync with each other.
 *
 * `accessibilityLayer={false}`: Recharts otherwise renders its root `<svg>`
 * with `role="application"` and `tabIndex={0}` regardless of the
 * surrounding `aria-hidden="true"` wrapper, leaving a real keyboard tab stop
 * inside a subtree assistive technology is told does not exist
 * (`aria-hidden-focus`) — the same defect `risk-level-chart.tsx` and
 * `treatment-actions-chart.tsx` already fixed the same way. The chart is
 * deliberately decorative; `<table className="sr-only">` is the real,
 * always-present equivalent.
 *
 * `isAnimationActive={false}`: `ResponsiveContainer` measures its own size
 * before the first real paint, so an animated mount would visibly "grow in"
 * a second time once the true width is known — with animation off the chart
 * simply appears once measured, never looking like a layout glitch (this
 * phase's acceptance criteria; CLAUDE.md §18.5 also asks to avoid
 * unnecessary animation on an institutional GRC surface).
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { cn } from '../lib/utils';

export interface TrendChartPoint {
  /** Stable row key, e.g. the measurement's ISO `computedAt` — never derived from `label`. */
  key: string;
  /** Already-formatted x-axis tick and accessible-table row header, e.g. a localized date/time. */
  label: string;
  /** One raw numeric value per series id declared in `seriesDefs`. */
  values: Readonly<Record<string, number>>;
}

export interface TrendChartSeriesDef {
  /** Matches a key present in every point's `values`. */
  id: string;
  /** Caller-provided display name — legend dot and accessible-table column header. */
  label: string;
  /** CSS color value, e.g. `var(--chart-1)` for a single-series metric or `var(--risk-critical-solid-bg)` to align a band series with `RiskLevelBadge`. */
  color: string;
}

export interface TrendChartLabels {
  /** Visually-hidden `<caption>` naming the accessible table for assistive technology. */
  tableCaption: string;
  /** Row-header column label, e.g. "Data". */
  dateColumnLabel: string;
  /** Shown instead of the chart/table when `points` is empty — never an empty axis with no explanation. */
  emptyState: string;
}

export interface TrendChartProps {
  /** Ordered oldest-to-newest — rendered as given, never re-sorted or re-aggregated here (CLAUDE.md §19.7, one calculator). */
  points: readonly TrendChartPoint[];
  /** One or more series drawn as lines and as accessible-table columns, sharing the same x-axis (`points`). */
  seriesDefs: readonly TrendChartSeriesDef[];
  labels: TrendChartLabels;
  /** Formats a raw value for the Y axis and the accessible table. Defaults to `String(value)` — the caller owns locale formatting (same convention as `SummaryStatCard.value`). */
  formatValue?: (value: number) => string;
  /** Chart area height in pixels. Default matches the platform's existing dashboard charts. */
  height?: number;
  className?: string;
}

const DEFAULT_HEIGHT = 240;

export function TrendChart({
  points,
  seriesDefs,
  labels,
  formatValue = (value) => String(value),
  height = DEFAULT_HEIGHT,
  className,
}: TrendChartProps): React.JSX.Element {
  if (points.length === 0) {
    return (
      <div
        role="note"
        style={{ height }}
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {labels.emptyState}
      </div>
    );
  }

  const chartData = points.map((point) => ({ label: point.label, ...point.values }));

  return (
    <div className={className}>
      <div aria-hidden="true" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              width={40}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={(value: number) => formatValue(value)}
            />
            {seriesDefs.map((series) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.id}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{labels.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{labels.dateColumnLabel}</th>
            {seriesDefs.map((series) => (
              <th key={series.id} scope="col">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              {seriesDefs.map((series) => (
                <td key={series.id}>{formatValue(point.values[series.id] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
