'use client';

/**
 * PharosGRC — compact executive context band for the redesigned
 * `/indicators` first screen (indicators-round, S1 ownership, coordinator
 * PLAN.md §2 step 2).
 *
 * Deliberately ONE card-row, never four KPI tiles: the baseline capture
 * (`s3-baseline.md` §6) measured the previous screen repeating "Escopo:
 * Organização inteira" and "Atualizado em …" verbatim eleven times, once per
 * card, with zero differentiating information between them — every key on
 * this platform is computed live, at request time (`s1-backend-domain.md`
 * "Extra" finding), so one shared statement here is honest where eleven
 * would only be noise. Per-card scope notes are reserved for the one real
 * exception (`COMPLIANCE_PERCENTAGE` under a unit-scoped caller) and rendered
 * by the card itself, never repeated here.
 *
 * The monitoring line is OMITTED, never zeroed, when the caller lacks
 * `indicator:view`'s own `summary.breakdowns.indicators` block (the same
 * "omitted, never zeroed" discipline `GetDashboardSummaryUseCase` already
 * applies server-side, `s1-backend-domain.md` Q13) — `monitoring` is
 * `undefined` in that case, not `{monitored: 0, breached: 0}`.
 *
 * ## Separators never dangle at a line end
 *
 * The second rendered review caught a real defect at 390px: `flex-wrap`
 * could break the row between a phrase and its trailing "·", leaving a
 * separator stranded alone at the end of a line ("11 indicadores ·" with
 * nothing after it until the next line). Below `sm` the three phrases now
 * stack as a plain vertical list — no separator glyph at all, so there is
 * nothing to dangle. At `sm` and up they return to one row with the "·"
 * rendered only BETWEEN two phrases that are actually side by side. The
 * refresh button lives in its own always-horizontal row (`justify-between`
 * against the info block, never inside the block that stacks/wraps), so it
 * stays pinned top-right at every width instead of also being pulled into
 * the stacking behaviour.
 */
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { indicators } from '@/lib/messages/indicators';
import { cn } from '@/lib/utils';

export interface IndicatorOverviewContextBandProps {
  readonly totalCount: number;
  /** Keys the caller could actually read (`reading.kind !== 'no-permission'`) — never larger than `totalCount`. */
  readonly availableCount: number;
  /** The caller's OWN resolved scope (`useAuth().scope.global`) — not any one metric's `scopeApplicability`. */
  readonly scopeGlobal: boolean;
  readonly fetchedAt: Date;
  /** `undefined` exactly when `summary.breakdowns.indicators` was absent — see this file's own header. */
  readonly monitoring?: { readonly monitored: number; readonly breached: number };
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly className?: string;
}

/** `fetchedAt` (a client-side `Date`, never a server `date-time` field) formatted to the minute — a distinct, smaller concern from `features/indicators/date.ts#formatTimestamp`, which exists for `IndicatorMeasurement.computedAt` strings from the API (that file's own header). */
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
