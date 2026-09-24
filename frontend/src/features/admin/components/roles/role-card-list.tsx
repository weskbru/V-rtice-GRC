'use client';

import { EmptyState, ErrorState } from '@pharos/design-system/components';
import { KeyRound, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { admin } from '@/lib/messages/admin';

import { RoleCard } from './role-card';

import type { Role } from '../../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

export interface RoleCardListProps {
  roles: readonly Role[];
  totalRoles: number;
  selectedRoleId: string | null;
  onSelect: (role: Role) => void;
  isLoading: boolean;
  error: ErrorStateProblem | undefined;
  onRetry: () => void;
  onClearFilters: () => void;
  createAction?: React.ReactNode;
}

function RoleCardSkeleton(): React.JSX.Element {
  return (
    <li
      aria-hidden="true"
      className="flex items-start gap-3 rounded-lg border border-l-4 border-border bg-card p-4"
    >
      <span className="size-9 shrink-0 animate-pulse rounded-md bg-muted" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="h-4 w-40 animate-pulse rounded bg-muted" />
        <span className="h-3 w-full animate-pulse rounded bg-muted" />
        <span className="h-3 w-2/3 animate-pulse rounded bg-muted" />
      </span>
    </li>
  );
}

export function RoleCardList({
  roles,
  totalRoles,
  selectedRoleId,
  onSelect,
  isLoading,
  error,
  onRetry,
  onClearFilters,
  createAction,
}: RoleCardListProps): React.JSX.Element {
  const messages = admin.roles.states;

  if (error) {
    return (
      <ErrorState
        problem={error}
        title={messages.error.title}
        message={error.detail ?? messages.error.description}
        action={
          <Button variant="outline" onClick={onRetry}>
            {messages.error.retry}
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <ul aria-busy="true" aria-label={messages.loadingLabel} className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((index) => (
          <RoleCardSkeleton key={index} />
        ))}
      </ul>
    );
  }

  if (roles.length === 0) {
    return totalRoles === 0 ? (
      <EmptyState
        variant="empty"
        icon={KeyRound}
        title={messages.emptyNone.title}
        description={messages.emptyNone.description}
        action={createAction}
      />
    ) : (
      <EmptyState
        variant="no-results"
        icon={SearchX}
        title={messages.emptyFiltered.title}
        description={messages.emptyFiltered.description}
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {messages.emptyFiltered.clearAction}
          </Button>
        }
      />
    );
  }

  return (
    <ul aria-label={admin.roles.card.listLabel} className="flex flex-col gap-3">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          role={role}
          selected={role.id === selectedRoleId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}
