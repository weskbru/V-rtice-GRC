'use client';

import { indicators } from '@/lib/messages/indicators';
import { ThresholdBreachBadge } from '@vertice/design-system/components';

import { formatTimestamp } from '../date';
import { orderedBucketEntries } from '../metric-card-value';

import type { IndicatorMeasurement } from '../types';
import type { ColumnDef } from '@vertice/design-system/components';

function formatMeasurementValue(record: IndicatorMeasurement): string {
  if (record.valueByBucket) {
    const entries = orderedBucketEntries(record.valueByBucket);
    return entries
      .map(({ level, count }) => `${indicators.bucketBadgeLabels.levelName(level)}: ${count}`)
      .join(', ');
  }
  return typeof record.value === 'number' ? record.value.toLocaleString('pt-BR') : '—';
}

export function buildIndicatorMeasurementColumns(
  hasThreshold: boolean,
): ColumnDef<IndicatorMeasurement, unknown>[] {
  const columns = indicators.history.columns;

  return [
    {
      id: 'computedAt',
      accessorKey: 'computedAt',
      header: columns.computedAt,
      enableSorting: false,
      size: 180,
      cell: ({ row }) => (
        <span className="text-foreground">{formatTimestamp(row.original.computedAt)}</span>
      ),
    },
    {
      id: 'value',
      header: columns.value,
      enableSorting: false,
      size: 260,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums text-foreground">
          {formatMeasurementValue(row.original)}
        </span>
      ),
    },
    {
      id: 'breached',
      header: columns.breached,
      enableSorting: false,
      size: 180,
      cell: ({ row }) =>
        hasThreshold ? (
          <ThresholdBreachBadge
            breached={row.original.breached}
            label={
              row.original.breached
                ? indicators.history.breachedLabel
                : indicators.history.notBreachedLabel
            }
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: 'computedBy',
      accessorFn: (row) => row.computedBy.fullName,
      header: columns.computedBy,
      enableSorting: false,
      size: 200,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.computedBy.fullName}</span>
      ),
    },
  ];
}
