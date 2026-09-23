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
