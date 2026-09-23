'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { actions } from '@/lib/messages/actions';
import { dashboard } from '@/lib/messages/dashboard';

import { ChartDataTable } from './chart-data-table';
import { ACTION_STATUS_CHART_COLOR } from './chart-tokens';

import type { ActionStatus } from '@/features/actions/types';

export interface ActionStatusDonutProps {
  byStatus: Readonly<Record<ActionStatus, number>>;
}

const STATUS_ORDER: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

interface Slice {
  readonly status: ActionStatus;
  readonly label: string;
  readonly count: number;
}

function SliceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload: Slice }[];
}): React.JSX.Element | null {
  const slice = payload?.[0]?.payload;
  if (!active || !slice) {
    return null;
  }
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
      <span className="font-medium">{slice.label}</span>
      <span className="ml-2 font-semibold">{slice.count.toLocaleString('pt-BR')}</span>
    </div>
  );
}

export function ActionStatusDonut({ byStatus }: ActionStatusDonutProps): React.JSX.Element {
  const copy = dashboard.charts.actionStatus;
  const slices: readonly Slice[] = STATUS_ORDER.map((status) => ({
    status,
    label: actions.statusLabels[status],
    count: byStatus[status],
  }));
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const drawn = slices.filter((slice) => slice.count > 0);

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @min-[19rem]:flex-row">
        <div aria-hidden="true" className="relative size-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              {total === 0 ? (
                <Pie
                  data={[{ count: 1 }]}
                  dataKey="count"
                  innerRadius="64%"
                  outerRadius="94%"
                  stroke="none"
                  isAnimationActive={false}
                  rootTabIndex={-1}
                >
                  <Cell fill="var(--muted)" />
                </Pie>
              ) : (
                <Pie
                  data={[...drawn]}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="64%"
                  outerRadius="94%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                  rootTabIndex={-1}
                >
                  {drawn.map((slice) => (
                    <Cell key={slice.status} fill={ACTION_STATUS_CHART_COLOR[slice.status]} />
                  ))}
                </Pie>
              )}
              {total > 0 ? <Tooltip content={<SliceTooltip />} cursor={false} /> : null}
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-foreground">
              {total.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-muted-foreground">{copy.totalLabel}</span>
          </div>
        </div>

        <ul className="flex w-full min-w-0 flex-col gap-2 text-sm" aria-hidden="true">
          {slices.map((slice) => (
            <li key={slice.status} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ACTION_STATUS_CHART_COLOR[slice.status] }}
              />
              <span className="min-w-0 flex-1 text-muted-foreground">{slice.label}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {slice.count.toLocaleString('pt-BR')}
              </span>
            </li>
          ))}
        </ul>

        <ChartDataTable
          caption={copy.caption}
          columnHeaders={[copy.columnHeaderStatus, copy.columnHeaderCount]}
          rows={slices.map((slice) => ({ label: slice.label, value: slice.count }))}
        />
      </div>
    </div>
  );
}
