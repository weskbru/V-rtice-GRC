'use client';

/**
 * PharosGRC — dashboard risk-level chart (T198, FR-049, FR-091, SC-012).
 *
 * Renders `Dashboard.risks.byResidualLevel` exactly as returned by
 * `GET /dashboard` — the four counts are never summed, filtered or
 * recomputed here (ADR-006, Constitution VI); this component only looks
 * each level up and draws it.
 *
 * Severity is never colour-only: each bar uses the same solid colour
 * `RiskLevelBadge` uses for that level (`RISK_LEVEL_CHART_COLOR`), but the
 * category axis already names the level in words, and a numeric label sits
 * on top of every bar — colour is the third signal, not the only one. A
 * screen-reader user gets the identical numbers from the visually-hidden
 * `ChartDataTable` instead of the `aria-hidden` SVG.
 *
 * `minPointSize` (wave 3): Recharts renders a zero-value bar at zero height
 * by default — indistinguishable from "no bar drawn at all", which is how
 * the baseline review found "Alto: 0" (a real, meaningful zero) reading as
 * a missing category rather than as data. A small non-zero minimum height
 * keeps every category's bar visible at its correct position and colour;
 * the `LabelList` above it still prints the true value ("0"), never a
 * rounded-up count.
 *
 * `accessibilityLayer={false}` (F-28, docs/deferred-findings.md): Recharts
 * turns this on by default and, when it is on, renders its root `<svg>` with
 * `role="application"` and `tabIndex={0}` regardless of what this component
 * wraps it in — so the surrounding `aria-hidden="true"` div did not stop the
 * SVG from being a real keyboard tab stop, an `aria-hidden-focus` violation
 * (a screen reader is told this subtree does not exist, yet a keyboard user
 * can still tab into it). The chart is deliberately decorative — the real,
 * operable equivalent is `ChartDataTable` — so the fix is to tell Recharts
 * not to build its own competing accessibility layer at all, at the source,
 * rather than trying to strip `role`/`tabIndex` back off the DOM node it
 * produces.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

import { dashboard } from '@/lib/messages/dashboard';
import { risks } from '@/lib/messages/risks';

import { ChartDataTable } from './chart-data-table';
import {
  CHART_AXIS_COLOR,
  CHART_GRID_COLOR,
  CHART_LABEL_COLOR,
  RISK_LEVEL_CHART_COLOR,
} from './chart-tokens';

import type { RiskLevel } from '@/features/risks/types';

export interface RiskLevelChartProps {
  byResidualLevel: Readonly<Record<RiskLevel, number>>;
}

const LEVEL_ORDER: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function RiskLevelChart({ byResidualLevel }: RiskLevelChartProps): React.JSX.Element {
  const copy = dashboard.charts.riskLevel;
  const data = LEVEL_ORDER.map((level) => ({
    level,
    label: risks.riskLevelLabels[level],
    count: byResidualLevel[level],
  }));

  return (
    <div>
      <div aria-hidden="true" className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[...data]}
            margin={{ top: 20, right: 8, left: 0, bottom: 8 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID_COLOR} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: CHART_GRID_COLOR }}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tickLine={false}
              axisLine={false}
              tick={{ fill: CHART_AXIS_COLOR, fontSize: 12 }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              minPointSize={3}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.level} fill={RISK_LEVEL_CHART_COLOR[entry.level]} />
              ))}
              <LabelList
                dataKey="count"
                position="top"
                fill={CHART_LABEL_COLOR}
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable
        caption={copy.caption}
        columnHeaders={[copy.columnHeaderLevel, copy.columnHeaderCount]}
        rows={data.map((entry) => ({ label: entry.label, value: entry.count }))}
      />
    </div>
  );
}
