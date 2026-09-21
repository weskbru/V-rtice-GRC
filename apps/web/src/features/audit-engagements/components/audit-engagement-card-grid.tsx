'use client';

/**
 * The grid frame — list semantics, responsive columns and the
 * loading/error/empty contract — is the shared `CardGrid`; what stays
 * here is which card to render and a skeleton shaped like it.
 *
 * PharosGRC — audit engagement catalog card view, the grid of
 * `AuditEngagementCard`s (T076, CLAUDE.md §18.12 — mirrors
 * `ControlCardGrid`/`RiskCardGrid`, minus the quick-view "compact" mode
 * neither this register offers — see `AuditEngagementCard`'s own doc
 * comment for why).
 */
import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { AuditEngagementCard } from './audit-engagement-card';

import type { AuditEngagement } from '../types';

import { Skeleton } from '@/components/ui/skeleton';
import { auditEngagements } from '@/lib/messages/audit-engagements';

export interface AuditEngagementCardGridProps {
  engagements: readonly AuditEngagement[];
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function AuditEngagementCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="h-5 w-24" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Skeleton className="h-3 w-32" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function AuditEngagementCardGrid({
  engagements: engagementList,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: AuditEngagementCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={engagementList}
      getItemKey={(engagement) => engagement.id}
      renderItem={(engagement) => <AuditEngagementCard engagement={engagement} />}
      regionLabel={auditEngagements.register.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={auditEngagements.register.results.countLoading}
      renderSkeleton={() => <AuditEngagementCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
