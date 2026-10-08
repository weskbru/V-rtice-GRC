'use client';

import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { actions } from '@/lib/messages/actions';

import { ActionCard } from './action-card';

import type { Action, ActionStatus } from '../types';

export interface ActionCardGridProps {
  actions: readonly Action[];
  canEdit: boolean;
  onTransition: (action: Action, to: ActionStatus) => void;
  onReopenRequest: (action: Action) => void;
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function ActionCardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-5 w-24" />
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

export function ActionCardGrid({
  actions: actionList,
  canEdit,
  onTransition,
  onReopenRequest,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: ActionCardGridProps): React.JSX.Element {
  return (
    <CardGrid
      items={actionList}
      getItemKey={(action) => action.id}
      renderItem={(action) => (
        <ActionCard
          action={action}
          canEdit={canEdit}
          onTransition={onTransition}
          onReopenRequest={onReopenRequest}
        />
      )}
      regionLabel={actions.myActions.card.regionLabel}
      isLoading={isLoading}
      loadingLabel={actions.myActions.results.countLoading}
      renderSkeleton={() => <ActionCardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
