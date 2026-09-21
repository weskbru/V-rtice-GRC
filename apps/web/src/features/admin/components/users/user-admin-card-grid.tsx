'use client';

/**
 * PharosGRC — Administration, users card grid (CLAUDE.md §18.12). The grid
 * frame itself is the shared `CardGrid`; what stays here is which card to
 * render and a skeleton shaped like it, mirroring `ActionCardGrid`'s
 * identical structure.
 */
import { CardGrid, type ErrorStateProblem } from '@pharos/design-system/components';

import { Skeleton } from '@/components/ui/skeleton';
import { admin } from '@/lib/messages/admin';

import { UserAdminCard } from './user-admin-card';

import type { AdminUser } from '../../types';

export interface UserAdminCardGridProps {
  users: readonly AdminUser[];
  currentUserId: string;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onManageRoles: (user: AdminUser) => void;
  isLoading: boolean;
  emptyContent: React.ReactNode;
  error?: ErrorStateProblem;
  errorAction?: React.ReactNode;
}

function CardSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

export function UserAdminCardGrid({
  users,
  currentUserId,
  canManageUsers,
  canManageRoles,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onRevokeSessions,
  onManageRoles,
  isLoading,
  emptyContent,
  error,
  errorAction,
}: UserAdminCardGridProps): React.JSX.Element {
  return (
    <CardGrid<AdminUser>
      items={users}
      getItemKey={(user) => user.id}
      regionLabel={admin.users.card.regionLabel}
      renderItem={(user) => (
        <UserAdminCard
          user={user}
          currentUserId={currentUserId}
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onResetPassword={onResetPassword}
          onRevokeSessions={onRevokeSessions}
          onManageRoles={onManageRoles}
        />
      )}
      isLoading={isLoading}
      loadingLabel={admin.users.results.countLoading}
      renderSkeleton={() => <CardSkeleton />}
      emptyContent={emptyContent}
      error={error}
      errorAction={errorAction}
    />
  );
}
