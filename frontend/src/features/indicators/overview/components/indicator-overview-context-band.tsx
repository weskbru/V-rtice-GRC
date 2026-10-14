'use client';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { indicators } from '@/lib/messages/indicators';
import { cn } from '@/lib/utils';

export interface IndicatorOverviewContextBandProps {
  readonly totalCount: number;
  readonly availableCount: number;
  readonly scopeGlobal: boolean;
  readonly fetchedAt: Date;
  readonly monitoring?: { readonly monitored: number; readonly breached: number };
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly className?: string;
}

function formatTimeOnly(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function IndicatorOverviewContextBand({
  totalCount,
  availableCount,
  scopeGlobal,
  fetchedAt,
  monitoring,
  isRefreshing,
  onRefresh,
  className,
}: IndicatorOverviewContextBandProps): React.JSX.Element {
  const band = indicators.overview.band;
  const missing = totalCount - availableCount;
  const countLabel =
    missing > 0
      ? band.countPartial(availableCount, totalCount, missing)
      : band.countAll(totalCount);
  const scopeLabel = band.scopePrefix(scopeGlobal ? band.scopeGlobal : band.scopeUnit);
  const timeLabel = band.calculatedAt(formatTimeOnly(fetchedAt));

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1">
          <span className="text-sm font-medium text-foreground">{countLabel}</span>
          <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
            ·
          </span>
          <span className="text-sm text-muted-foreground">{scopeLabel}</span>
          <span aria-hidden="true" className="hidden text-muted-foreground sm:inline">
            ·
          </span>
          <span className="text-sm text-muted-foreground">{timeLabel}</span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="shrink-0 gap-1.5"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-3.5', isRefreshing && 'animate-spin motion-reduce:animate-none')}
          />
          {band.refreshAction}
        </Button>
        {isRefreshing ? (
          <span role="status" className="sr-only">
            {band.refreshing}
          </span>
        ) : null}
      </div>

      {monitoring ? (
        <p className="text-xs text-muted-foreground">
          {monitoring.monitored === 0
            ? band.monitoringNone
            : band.monitoringSummary(monitoring.monitored, monitoring.breached)}
        </p>
      ) : null}
    </div>
  );
}
