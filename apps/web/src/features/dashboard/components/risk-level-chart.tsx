'use client';

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
