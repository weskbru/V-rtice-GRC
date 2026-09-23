'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { cn } from '../lib/utils';

export interface TrendChartPoint {
  key: string;
  label: string;
  values: Readonly<Record<string, number>>;
}

export interface TrendChartSeriesDef {
  id: string;
  label: string;
  color: string;
}

export interface TrendChartLabels {
  tableCaption: string;
  dateColumnLabel: string;
  emptyState: string;
}

export interface TrendChartProps {
  points: readonly TrendChartPoint[];
  seriesDefs: readonly TrendChartSeriesDef[];
  labels: TrendChartLabels;
  formatValue?: (value: number) => string;
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
