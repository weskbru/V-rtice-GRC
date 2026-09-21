'use client';

/**
 * PharosGRC — indicator history section (T060, 009-indicators-reports,
 * US2/US6). Renders inside the indicator detail page's "Histórico" tab.
 *
 * ## The scope gate is explained, never a bare error (this task's own
 * ## explicit acceptance criterion)
 *
 * `GET/POST .../measurements` both require the caller's resolved scope to
 * be `GLOBAL` (research.md D-6). This component checks `useAuth().scope
 * .global` FIRST, before issuing any request: a `UNIT`-scoped caller never
 * even sees a loading spinner or a `403` — they see
 * `indicators.history.scopeRestricted`'s own explanation, rendered as an
 * ordinary, expected state (CLAUDE.md §18.11), never as `ErrorState`. The
 * server's own `403` (`CreateIndicatorMeasurementUseCase`/
 * `ListIndicatorMeasurementsUseCase`) remains the actual authorization
 * boundary (ADR-003) — this is advisory UI, same warning as
 * `usePermissions()`'s own — but the client-provided `EffectiveScope
 * .global` is not a permission the server might revoke asynchronously the
 * way an RBAC grant can be; it is the same scope the session itself
 * carries, so treating it as reliable here (rather than always attempting
 * the request and parsing a 403) is deliberate, not a shortcut.
 *
 * ## One fetch feeds both the chart and the table
 *
 * `TrendChart` (`@pharos/design-system`, T059 — its first real render) and
 * `DataTable` below both render the SAME page of `IndicatorMeasurement`
 * records from the SAME `listMeasurements` response — never two
 * independent fetches that could show a different set of points (the
 * defect class F-28 already paid for once, `docs/deferred-findings.md`).
 */
import {
  DataTable,
  EmptyState,
  ErrorState,
  ThresholdBreachBadge,
  TrendChart,
} from '@pharos/design-system/components';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';

import { indicatorsApi } from '../api';
import { formatTimestamp } from '../date';
import { orderedBucketEntries } from '../metric-card-value';
import { RISK_LEVEL_CHART_COLOR } from '../metric-visuals';

import { buildIndicatorMeasurementColumns } from './indicator-measurement-columns';

import type { IndicatorMeasurement, IndicatorMetricKey } from '../types';
import type { ErrorStateProblem, TrendChartSeriesDef } from '@pharos/design-system/components';

export interface IndicatorHistorySectionProps {
  metricKey: IndicatorMetricKey;
  metricLabel: string;
  /** Whether the metric's CURRENT `IndicatorDefinition` has a threshold configured — see `indicator-measurement-columns.tsx`'s own header for why this changes how `breached` renders. */
  hasThreshold: boolean;
  /** Advisory-only (`usePermissions()`'s own warning) — hides the "Registrar medição" action for a caller who would definitely get a `403`. */
  canEdit: boolean;
}

const PAGE_SIZE = 20;

export function IndicatorHistorySection({
  metricKey,
  metricLabel,
  hasThreshold,
  canEdit,
}: IndicatorHistorySectionProps): React.JSX.Element {
  const { scope } = useAuth();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<readonly IndicatorMeasurement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [registering, setRegistering] = useState(false);

  const requestKey = `${page}|${reloadToken}`;
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = scope.global && resolvedRequestKey !== requestKey;

  useEffect(() => {
    if (!scope.global) return;
    let cancelled = false;

    indicatorsApi
      .listMeasurements(metricKey, { page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setTotal(result.meta.total);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(
          caught instanceof ApiError
            ? {
                title: caught.problem.title,
                detail: caught.problem.detail,
                correlationId: caught.problem.correlationId,
              }
            : {},
        );
        setResolvedRequestKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` already derives from `page`/`reloadToken`.
  }, [metricKey, scope.global, requestKey]);

  if (!scope.global) {
    return (
      <EmptyState
        icon={Lock}
        title={indicators.history.scopeRestricted.title}
        description={indicators.history.scopeRestricted.description}
      />
    );
  }

  async function handleRegisterMeasurement(): Promise<void> {
    setRegistering(true);
    try {
      await indicatorsApi.createMeasurement(metricKey);
      feedback.success(indicators.history.registerMeasurementSuccess(metricLabel));
      // A new point sorts to the END of the ascending series — jump to the
      // last page so the caller actually sees what they just recorded,
      // rather than landing back on whatever page they started from.
      const refreshed = await indicatorsApi.listMeasurements(metricKey, {
        page: 1,
        pageSize: PAGE_SIZE,
      });
      const nextTotalPages = Math.max(1, refreshed.meta.totalPages);
      setPage(nextTotalPages);
      setReloadToken((token) => token + 1);
    } catch {
      feedback.error(indicators.history.registerMeasurementError);
    } finally {
      setRegistering(false);
    }
  }

  const columns = buildIndicatorMeasurementColumns(hasThreshold);

  const chartPoints = rows.map((row) => ({
    key: row.id,
    label: formatTimestamp(row.computedAt),
    values: row.valueByBucket
      ? Object.fromEntries(
          orderedBucketEntries(row.valueByBucket).map(({ level, count }) => [level, count]),
        )
      : { value: row.value ?? 0 },
  }));

  const bucketSeries: TrendChartSeriesDef[] = orderedBucketEntries(rows[0]?.valueByBucket).map(
    ({ level }) => ({
      id: level,
      label: indicators.bucketBadgeLabels.levelName(level),
      color: RISK_LEVEL_CHART_COLOR[level],
    }),
  );
  const seriesDefs: TrendChartSeriesDef[] =
    bucketSeries.length > 0
      ? bucketSeries
      : [{ id: 'value', label: metricLabel, color: 'var(--chart-1)' }];

  const latestOnThisPage = page === totalPages ? rows[rows.length - 1] : undefined;

  const emptyContent = (
    <EmptyState
      variant="empty"
      title={indicators.history.empty.title}
      description={indicators.history.empty.description}
    />
  );
  const errorAction = (
    <Button variant="outline" onClick={() => setReloadToken((token) => token + 1)}>
      {common.actions.retry}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{indicators.history.sectionDescription}</p>
          {!hasThreshold ? (
            <p className="text-xs text-muted-foreground">
              {indicators.history.thresholdNotConfiguredNote}
            </p>
          ) : null}
          {latestOnThisPage && hasThreshold ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground">
                {indicators.history.latestMeasurementLabel(
                  formatTimestamp(latestOnThisPage.computedAt),
                )}
              </span>
              <ThresholdBreachBadge
                breached={latestOnThisPage.breached}
                label={
                  latestOnThisPage.breached
                    ? indicators.history.breachedLabel
                    : indicators.history.notBreachedLabel
                }
              />
            </div>
          ) : null}
        </div>
        {canEdit ? (
          <Button onClick={() => void handleRegisterMeasurement()} disabled={registering}>
            {indicators.history.registerMeasurementAction}
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState problem={error} title={indicators.history.loadError} action={errorAction} />
      ) : (
        <>
          {rows.length > 0 || loading ? (
            <TrendChart
              points={chartPoints}
              seriesDefs={seriesDefs}
              labels={{
                tableCaption: indicators.history.chartTableCaption(metricLabel),
                dateColumnLabel: indicators.history.dateColumnLabel,
                emptyState: indicators.history.chartEmptyState,
              }}
            />
          ) : null}

          <DataTable<IndicatorMeasurement>
            columns={columns}
            data={rows}
            getRowId={(row) => row.id}
            sorting={[]}
            onSortingChange={() => undefined}
            pageIndex={page - 1}
            pageSize={PAGE_SIZE}
            totalRows={total}
            onPageIndexChange={(index) => setPage(index + 1)}
            onPageSizeChange={() => undefined}
            pageSizeOptions={[PAGE_SIZE]}
            labels={{ ...common.dataTable, loading: indicators.history.loading }}
            isLoading={loading}
            emptyContent={emptyContent}
            caption={indicators.history.tableCaption(metricLabel)}
          />
        </>
      )}
    </div>
  );
}
