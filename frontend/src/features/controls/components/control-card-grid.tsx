'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { controls } from '@/lib/messages/controls';

import { ControlCard } from './control-card';

import type { ControlSummary } from '../types';

export interface ControlCardGridProps {
  controls: readonly ControlSummary[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function ControlCardSkeleton(): React.JSX.Element {
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
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function ControlCardGrid({
  controls: controlList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: ControlCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={controlList}
      getItemKey={(control) => control.id}
      renderItem={(control) => <ControlCard control={control} />}
      regionLabel={controls.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={controls.register.results.countLoading}
      renderSkeleton={() => <ControlCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
