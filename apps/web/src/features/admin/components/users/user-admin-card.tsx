'use client';

/**
 * PharosGRC — Administration, users card view, one user (CLAUDE.md §18,
 * §18.12). Mirrors `ActionCard`'s shape: initials + name + e-mail, status
 * badge and the SAME row-actions menu (`UserRowActionsMenu`) in the header
 * — the same three fields the table's own columns show, so the two views
 * can never disagree about what a user "is".
 *
 * ## Papéis gets its own full-width row — a rendered measurement found why the original three-equal-column row could not stay
 *
 * The original metadata section split Unidade / Papéis / Último acesso into
 * three equal `grid-cols-3` columns. At 1440 that gave Papéis roughly a
 * third of the card (~100px) — narrow enough that a single role badge's OWN
 * label wrapped mid-word ("Responsável por / Controle"), and two badges
 * stacked vertically, so card height drifted with how many roles a user
 * held. Roles are the richest field a user card carries; squeezing them
 * into one of three equal columns was the defect, not the badge component.
 *
 * Papéis now renders BELOW, across the card's full width, fit to ONE line
 * via `UserRoleBadges`'s `widthBudget="measure"` mode (that component's own
 * header explains the measurement). Unidade and Último acesso share the
 * row ABOVE it — two columns, not three — so neither truncates the way
 * `title="Division A / Tea…"`/`13:04…` did in the cramped three-column
 * layout.
 *
 * Deliberately NOT a link to a detail route: unlike every business
 * register, Administration → Usuários has no `/admin/users/{id}` page —
 * every user action (edit, roles, status, password, sessions) is a dialog
 * reached from the row-actions menu, so the card itself opens nothing.
 */
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
        {/* Unidade / Último acesso — two columns, not three, so neither
            truncates the way it did when Papéis shared this row (this
            file's own header). */}
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

        {/* Papéis — a full-width row of its own, fit to ONE line against
            this row's own measured width (`widthBudget="measure"`, see
            `UserRoleBadges`'s own header). */}
        <div className="flex min-w-0 flex-col gap-0.5 text-xs">
          <span className="text-muted-foreground">{card.rolesLabel}</span>
          <UserRoleBadges roles={user.roles} widthBudget="measure" />
        </div>
      </div>
    </article>
  );
}
