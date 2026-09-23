'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { problems } from '@/lib/messages/problems';

import { ProblemCard } from './problem-card';

import type { ProblemSummary } from '../types';

export interface ProblemCardGridProps {
  problems: readonly ProblemSummary[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function ProblemCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4/5" />
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

export function ProblemCardGrid({
  problems: problemList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: ProblemCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={problemList}
      getItemKey={(problem) => problem.id}
      renderItem={(problem) => <ProblemCard problem={problem} />}
      regionLabel={problems.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={problems.register.results.countLoading}
      renderSkeleton={() => <ProblemCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
