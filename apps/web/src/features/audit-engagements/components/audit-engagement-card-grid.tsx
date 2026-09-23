'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { auditEngagements } from '@/lib/messages/audit-engagements';

import { AuditEngagementCard } from './audit-engagement-card';

import type { AuditEngagement } from '../types';

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
