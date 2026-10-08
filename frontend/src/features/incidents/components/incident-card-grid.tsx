'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { incidents } from '@/lib/messages/incidents';

import { IncidentCard } from './incident-card';

import type { IncidentSummary } from '../types';

export interface IncidentCardGridProps {
  incidents: readonly IncidentSummary[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function IncidentCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
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

export function IncidentCardGrid({
  incidents: incidentList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: IncidentCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={incidentList}
      getItemKey={(incident) => incident.id}
      renderItem={(incident) => <IncidentCard incident={incident} />}
      regionLabel={incidents.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={incidents.register.results.countLoading}
      renderSkeleton={() => <IncidentCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
