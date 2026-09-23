'use client';

import { EmptyValue, StatusBadge } from '@pharos/design-system/components';
import { Building2, Clock } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { admin } from '@/lib/messages/admin';
import { cn } from '@/lib/utils';

import { userInitials } from './user-initials';
import { UserRoleBadges } from './user-role-badges';
import { UserRowActionsMenu } from './user-row-actions-menu';

import type { AdminUser } from '../../types';

export interface UserAdminCardProps {
  user: AdminUser;
  currentUserId: string;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onManageRoles: (user: AdminUser) => void;
}

export function UserAdminCard({
  user,
  currentUserId,
  canManageUsers,
  canManageRoles,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onRevokeSessions,
  onManageRoles,
}: UserAdminCardProps): React.JSX.Element {
  const card = admin.users.card;

  return (
    <article
      className={cn(
        'flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors',
        'hover:border-ring/60 hover:bg-accent/20',
        'has-[:focus-visible]:border-ring/60 has-[:focus-visible]:bg-accent/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback aria-hidden="true">{userInitials(user.fullName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">{user.fullName}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>

        <UserRowActionsMenu
          user={user}
          currentUserId={currentUserId}
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onResetPassword={onResetPassword}
          onRevokeSessions={onRevokeSessions}
          onManageRoles={onManageRoles}
          className="-mt-1 -mr-1 shrink-0"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          variant={user.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={user.status === 'ACTIVE' ? admin.users.status.active : admin.users.status.inactive}
        />
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Building2 aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{card.orgUnitLabel}</span>
            </dt>
            <dd className="truncate font-medium text-foreground">
              {user.primaryOrgUnit ? (
                user.primaryOrgUnit.name
              ) : (
                <EmptyValue>{admin.users.table.noOrgUnit}</EmptyValue>
              )}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <Clock aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{card.lastLoginLabel}</span>
            </dt>
            <dd className="truncate font-medium text-foreground">
              {user.lastLoginAt ? (
                new Date(user.lastLoginAt).toLocaleString('pt-BR')
              ) : (
                <EmptyValue>{admin.users.table.neverLoggedIn}</EmptyValue>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex min-w-0 flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">{card.rolesLabel}</span>
          <UserRoleBadges roles={user.roles} widthBudget="measure" />
        </div>
      </div>
    </article>
  );
}
