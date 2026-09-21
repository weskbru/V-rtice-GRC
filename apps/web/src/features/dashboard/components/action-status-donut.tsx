'use client';

/**
 * PharosGRC — action plans by status, as a donut with a legend.
 *
 * ## Why a donut here, and not for risks by status
 *
 * A donut is honest for part-to-whole at a glance with few segments. Actions
 * have four statuses, so the ring reads immediately. Risks have eight, several
 * of them usually zero; eight slices blur, so that chart stays a labelled bar
 * list (`RiskStatusChart`).
 *
 * ## Reading it without the colours
 *
 * The legend names every status with its exact count, always — including the
 * zeros, which have no arc to show — and the total sits in the centre. The
 * ring is the glance; the legend is the reading; `ChartDataTable` is the
 * screen-reader twin. Segments are separated by a 2px gap in the card colour
 * rather than an outline.
 *
 * ## Out of the tab order
 *
 * Recharts gives every `Pie` `tabindex="0"` by default. Inside the
 * `aria-hidden` ring that is a keyboard stop on something a screen reader
 * cannot see (axe `aria-hidden-focus`, caught by the dashboard scan), so both
 * pies set `rootTabIndex={-1}`: the legend and the data table already carry
 * every value.
 *
 * ## Zero total
 *
 * A scope with no actions renders a muted full ring with "0" in the centre —
 * visibly a real empty state, not a chart that failed to draw.
 */
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
    // Side by side only when THIS card is wide enough, not the viewport: the
    // card sits in a three-column row at 1280px and a two-column row at
    // 1024px, and a viewport breakpoint put the ring beside a legend squeezed
    // to "Ab…", "Em an…" in both. A container query keys the layout to the
    // space the legend actually gets.
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
