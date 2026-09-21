'use client';

/**
 * PharosGRC — Administration, the users row-actions menu, shared by the
 * table column (`user-admin-columns.tsx`) and the card view
 * (`user-admin-card.tsx`) — ONE component, not two independent copies of
 * the same permission-gated menu (the coordinator's explicit instruction
 * for this task, mirroring `features/actions/components/action-row-menu
 * .tsx`'s own precedent).
 *
 * Every tier's visibility and enablement here is advisory only — the server
 * re-validates `user:administer`/`role:administer` and every business rule
 * (e.g. a caller cannot deactivate their own account) independently on
 * submit. `isSelf`/`canManageUsers`/`canManageRoles` only decide what this
 * menu OFFERS, never what the server ultimately allows.
 */
import { KeyRound, LogOut, MoreHorizontal, Pencil, Power, ShieldOff, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { admin } from '@/lib/messages/admin';

import type { AdminUser } from '../../types';

/**
 * Text/icon tone for the "sensitive" action tier — security-relevant,
 * consequential but non-destructive (no data is deleted). Reuses the
 * platform's existing warning tokens (`status-badge.tsx`) rather than
 * inventing a new colour (CLAUDE.md §18.11 — never make an ordinary edit
 * and a security-sensitive action look the same, and never make that
 * action look interchangeable with an outright destructive one either).
 */
const SENSITIVE_ACTION_CLASS =
  'text-status-warning-fg focus:bg-status-warning-bg focus:text-status-warning-fg';
/** Applied directly to the icon inside a sensitive-tier item — a plain `text-*` class on the `<svg>` itself, which the dropdown primitive's own default colour rule (`[&_svg:not([class*='text-'])]:text-muted-foreground`) explicitly steps aside for, rather than fighting it via a parent-level selector. */
const SENSITIVE_ICON_CLASS = 'text-status-warning-fg';

export interface UserRowActionsMenuProps {
  user: AdminUser;
  currentUserId: string;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onManageRoles: (user: AdminUser) => void;
  className?: string;
}

/** `null` when the caller holds neither `user:administer` nor `role:administer` — callers render nothing rather than a trigger with an empty menu. */
export function UserRowActionsMenu({
  user,
  currentUserId,
  canManageUsers,
  canManageRoles,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onRevokeSessions,
  onManageRoles,
  className,
}: UserRowActionsMenuProps): React.JSX.Element | null {
  if (!canManageUsers && !canManageRoles) {
    return null;
  }

  const isSelf = user.id === currentUserId;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={admin.users.actions.rowActionsLabel(user.fullName)}
          className={className}
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManageUsers ? (
          <DropdownMenuItem onSelect={() => onEdit(user)}>
            <Pencil aria-hidden="true" className="size-4" />
            {admin.users.actions.edit}
          </DropdownMenuItem>
        ) : null}
        {canManageRoles ? (
          <DropdownMenuItem onSelect={() => onManageRoles(user)}>
            <Users aria-hidden="true" className="size-4" />
            {admin.users.actions.manageRoles}
          </DropdownMenuItem>
        ) : null}
        {canManageUsers ? (
          <>
            {/* Everything below ends a live session or credential outright, or requires re-authentication everywhere — a materially different weight of action than the ordinary edits above (CLAUDE.md §18.11). The separator marks that boundary; amber (`SENSITIVE_ACTION_CLASS`) and red (`variant="destructive"`) then tell the two remaining tiers apart from each other. */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSelf && user.status === 'ACTIVE'}
              title={
                isSelf && user.status === 'ACTIVE'
                  ? admin.users.statusDialog.selfDeactivateError
                  : undefined
              }
              className={user.status === 'ACTIVE' ? SENSITIVE_ACTION_CLASS : undefined}
              onSelect={() => onToggleStatus(user)}
            >
              {user.status === 'ACTIVE' ? (
                <ShieldOff aria-hidden="true" className={SENSITIVE_ICON_CLASS} />
              ) : (
                <Power aria-hidden="true" className="size-4" />
              )}
              {user.status === 'ACTIVE'
                ? admin.users.actions.deactivate
                : admin.users.actions.activate}
            </DropdownMenuItem>
            <DropdownMenuItem
              className={SENSITIVE_ACTION_CLASS}
              onSelect={() => onResetPassword(user)}
            >
              <KeyRound aria-hidden="true" className={SENSITIVE_ICON_CLASS} />
              {admin.users.actions.resetPassword}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onRevokeSessions(user)}>
              <LogOut aria-hidden="true" className="size-4" />
              {admin.users.actions.revokeSessions}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
