'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { risks } from '@/lib/messages/risks';
import { CardGrid, type ErrorStateProblem } from '@vertice/design-system/components';

import { RiskCard } from './risk-card';

import type { RiskLevelBasis, RiskSummary } from '../types';

export interface RiskCardGridProps {
  risks: readonly RiskSummary[];
  riskLevelBasis: RiskLevelBasis;
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

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
