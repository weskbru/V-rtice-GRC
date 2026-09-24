'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { compliance } from '@/lib/messages/compliance';

import { FrameworkCard } from './framework-card';

import type { Framework } from '../types';

export interface FrameworkCardGridProps {
  frameworks: readonly Framework[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function FrameworkCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function FrameworkCardGrid({
  frameworks,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: FrameworkCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={frameworks}
      getItemKey={(framework) => framework.id}
      renderItem={(framework) => <FrameworkCard framework={framework} />}
      regionLabel={compliance.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={compliance.register.results.countLoading}
      renderSkeleton={() => <FrameworkCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
