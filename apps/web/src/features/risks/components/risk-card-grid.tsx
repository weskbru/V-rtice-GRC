'use client';

/**
 * PharosGRC — risk register card view (US3, CLAUDE.md §18).
 *
 * The grid frame itself — list semantics, responsive columns, the
 * loading/error/empty contract — is `CardGrid` from `@pharos/design-system`,
 * shared with every other register that shows cards. What stays here is the
 * part that is genuinely about risks: which card to render, and a skeleton
 * shaped like that card so the grid does not visibly jump when real records
 * arrive.
 */
import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { risks } from '@/lib/messages/risks';

import { RiskCard } from './risk-card';

import type { RiskLevelBasis, RiskSummary } from '../types';

export interface RiskCardGridProps {
  risks: readonly RiskSummary[];
  riskLevelBasis: RiskLevelBasis;
  isLoading: boolean;
  /** Rendered instead of the grid when there are no results. */
  emptyContent: React.ReactNode;
  /** Set when the request failed; render an error state instead of the grid. */
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

/** Matches a real `RiskCard`'s approximate height so the loading state does not visibly jump once real cards arrive. */
function RiskCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="flex gap-1.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-24" />
      </div>
      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function RiskCardGrid({
  risks: riskList,
  riskLevelBasis,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: RiskCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={riskList}
      getItemKey={(risk) => risk.id}
      renderItem={(risk) => <RiskCard risk={risk} riskLevelBasis={riskLevelBasis} />}
      regionLabel={risks.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={risks.register.results.countLoading}
      renderSkeleton={() => <RiskCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
