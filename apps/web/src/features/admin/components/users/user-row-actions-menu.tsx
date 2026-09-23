'use client';

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

const SENSITIVE_ACTION_CLASS =
  'text-status-warning-fg focus:bg-status-warning-bg focus:text-status-warning-fg';
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
