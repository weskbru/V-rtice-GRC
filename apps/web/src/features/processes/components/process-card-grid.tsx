'use client';

/**
 * The grid frame — list semantics, responsive columns and the
 * loading/error/empty contract — is the shared `CardGrid`; what stays
 * here is which card to render and a skeleton shaped like it.
 *
 * PharosGRC — process catalog card view, the grid of `ProcessCard`s (T046,
 * CLAUDE.md §18.12 — mirrors `AuditEngagementCardGrid`).
 */
import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { ProcessCard } from './process-card';

import type { ProcessSummary } from '../types';

import { Skeleton } from '@/components/ui/skeleton';
import { processes } from '@/lib/messages/processes';

export interface ProcessCardGridProps {
  processes: readonly ProcessSummary[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function ProcessCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-5 w-20" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function ProcessCardGrid({
  processes: processList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: ProcessCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={processList}
      getItemKey={(process) => process.id}
      renderItem={(process) => <ProcessCard process={process} />}
      regionLabel={processes.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={processes.register.results.countLoading}
      renderSkeleton={() => <ProcessCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
