'use client';

import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { common } from '@/lib/messages/common';
import { indicators } from '@/lib/messages/indicators';
import {
  DataTable,
  EmptyState,
  ErrorState,
  ThresholdBreachBadge,
  TrendChart,
} from '@vertice/design-system/components';

import { indicatorsApi } from '../api';
import { formatTimestamp } from '../date';
import { orderedBucketEntries } from '../metric-card-value';
import { RISK_LEVEL_CHART_COLOR } from '../metric-visuals';

import { buildIndicatorMeasurementColumns } from './indicator-measurement-columns';

import type { IndicatorMeasurement, IndicatorMetricKey } from '../types';
import type { ErrorStateProblem, TrendChartSeriesDef } from '@vertice/design-system/components';

export interface IndicatorHistorySectionProps {
  metricKey: IndicatorMetricKey;
  metricLabel: string;
  hasThreshold: boolean;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva das dependências listadas.
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
