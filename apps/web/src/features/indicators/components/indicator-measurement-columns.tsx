'use client';

/**
 * PharosGRC — indicator measurement history table columns (T060,
 * 009-indicators-reports, US2), mirroring `incident-register-columns.tsx`'s
 * own shape (CLAUDE.md §18.12).
 *
 * `breached` renders through `ThresholdBreachBadge` (`@pharos/design-
 * system`) — the FIRST real render of that component (T058's own pending
 * §18.11 gate) — EXCEPT when the caller tells us (`hasThreshold: false`,
 * from the metric's current `IndicatorDefinition`) that no threshold is
 * configured today: `IndicatorMeasurement.breached` is `false` in that
 * case too (its own schema comment — "always false when no definition, or
 * no threshold, existed at that moment"), and rendering the badge would
 * misleadingly read as "measured against a threshold and found within it"
 * rather than "no threshold to measure against". A plain dash renders
 * instead, matching every other "not applicable" cell in this product's
 * tables.
 */
import { ThresholdBreachBadge } from '@pharos/design-system/components';

import { indicators } from '@/lib/messages/indicators';

import { formatTimestamp } from '../date';
import { orderedBucketEntries } from '../metric-card-value';

import type { IndicatorMeasurement } from '../types';
import type { ColumnDef } from '@pharos/design-system/components';

/** `IndicatorMeasurement.value`/`valueByBucket` rendered as one cell — a plain number for `SINGLE_VALUE`, or a compact "Baixo: 2, Médio: 1, …" summary for `BY_BUCKET` (a full `RiskLevelBadge` per row would be too heavy for a table cell; the catalog/detail cards already give that treatment its own real estate). */
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
