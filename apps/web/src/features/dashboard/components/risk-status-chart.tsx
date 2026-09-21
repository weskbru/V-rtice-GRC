/**
 * PharosGRC — dashboard risk-status distribution (T198, FR-049, FR-091,
 * SC-012).
 *
 * Renders `Dashboard.risks.byStatus` exactly as returned by `GET /dashboard`
 * — the eight lifecycle counts are never summed, filtered or recomputed
 * here (ADR-006, Constitution VI). Colour reuses `riskStatusBadgeVariant`
 * (`@/features/risks/status`), the same mapping the register's `StatusBadge`
 * already uses for `RiskStatus`, so this view and the register never
 * disagree about what a status "looks like".
 *
 * ## Why this is a horizontal bar list, not a Recharts bar chart (wave 3)
 *
 * The previous version was a vertical Recharts bar chart with eight
 * category labels rotated -30° along the x-axis — rejected outright by the
 * phase brief regardless of the data, and doubly wrong for this particular
 * distribution: in production data one lifecycle stage (`DRAFT`/"Rascunho")
 * dominates and the other seven sit near zero next to it, so a chart whose
 * y-axis has to span the tallest bar leaves most rows visually
 * indistinguishable from empty. A risk manager reading this tile is asking
 * "how many risks are at each stage, and which stages barely have any" —
 * a ranked list answers that directly: every label reads horizontally
 * (no rotation, no diagonal text to decode), every row — including a
 * genuine zero — gets equal vertical space and its own visible numeral, and
 * the relative bar length still shows the skew at a glance.
 *
 * This is deliberately a real, visible `<table>`, not an `aria-hidden`
 * decorative chart with a separate hidden text mirror (contrast
 * `risk-level-chart.tsx`/`treatment-actions-chart.tsx`, which stay Recharts
 * and so still need `ChartDataTable`): every label and count here is normal
 * accessible text; only the proportional bar fill is `aria-hidden`
 * decoration alongside it, so colour is a third signal on top of the
 * already-legible label and numeral (§18.8) — never the only one.
 */
import { dashboard } from '@/lib/messages/dashboard';
import { risks } from '@/lib/messages/risks';

import { riskStatusChartColor } from './chart-tokens';

import type { RiskStatus } from '@/features/risks/types';

export interface RiskStatusChartProps {
  byStatus: Readonly<Record<RiskStatus, number>>;
}

const STATUS_ORDER: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
];

export function RiskStatusChart({ byStatus }: RiskStatusChartProps): React.JSX.Element {
  const copy = dashboard.charts.riskStatus;
  const data = STATUS_ORDER.map((status) => ({
    status,
    label: risks.statusLabels[status],
    count: byStatus[status],
  }));
  const maxCount = Math.max(1, ...data.map((entry) => entry.count));

  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{copy.caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">{copy.columnHeaderStatus}</th>
          <th scope="col">{copy.columnHeaderCount}</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr key={entry.status}>
            <th
              scope="row"
              className="w-28 shrink-0 py-1 pr-3 text-left align-middle font-normal text-muted-foreground"
            >
              {entry.label}
            </th>
            <td className="py-1 align-middle">
              <div className="flex items-center gap-2">
                <div
                  aria-hidden="true"
                  className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((entry.count / maxCount) * 100, entry.count > 0 ? 3 : 0)}%`,
                      backgroundColor: riskStatusChartColor(entry.status),
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-semibold text-foreground">
                  {entry.count.toLocaleString('pt-BR')}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
