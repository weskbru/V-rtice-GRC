'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { admin } from '@/lib/messages/admin';
import { roleDisplayName } from '@/lib/role-display-name';
import { EmptyValue, StatusBadge } from '@vertice/design-system/components';

import { userInitials } from './user-initials';
import { UserRoleBadges } from './user-role-badges';
import { UserRowActionsMenu } from './user-row-actions-menu';

import type { AdminUser } from '../../types';
import type { ColumnDef } from '@vertice/design-system/components';

export const USER_ADMIN_COLUMN_IDS = {
  fullName: 'fullName',
  email: 'email',
  status: 'status',
  orgUnit: 'orgUnit',
  roles: 'roles',
  lastLoginAt: 'lastLoginAt',
  actions: 'actions',
} as const;

export const USER_ADMIN_HIDEABLE_COLUMNS: readonly { id: string; label: string }[] = [
  { id: USER_ADMIN_COLUMN_IDS.email, label: admin.users.table.columns.email },
  { id: USER_ADMIN_COLUMN_IDS.status, label: admin.users.table.columns.status },
  { id: USER_ADMIN_COLUMN_IDS.orgUnit, label: admin.users.table.columns.orgUnit },
  { id: USER_ADMIN_COLUMN_IDS.roles, label: admin.users.table.columns.roles },
  { id: USER_ADMIN_COLUMN_IDS.lastLoginAt, label: admin.users.table.columns.lastLoginAt },
];

export interface BuildUserAdminColumnsOptions {
  currentUserId: string;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onRevokeSessions: (user: AdminUser) => void;
  onManageRoles: (user: AdminUser) => void;
}

export function buildUserAdminColumns({
  currentUserId,
  canManageUsers,
  canManageRoles,
  onEdit,
  onToggleStatus,
  onResetPassword,
  onRevokeSessions,
  onManageRoles,
}: BuildUserAdminColumnsOptions): ColumnDef<AdminUser, unknown>[] {
  const columns: ColumnDef<AdminUser, unknown>[] = [
    {
      id: USER_ADMIN_COLUMN_IDS.fullName,
      accessorKey: 'fullName',
      header: admin.users.table.columns.fullName,
      enableHiding: false,
      size: 220,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback aria-hidden="true">
              {userInitials(row.original.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">{row.original.fullName}</span>
            {row.original.jobTitle ? (
              <span className="truncate text-sm text-muted-foreground">
                {row.original.jobTitle}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: USER_ADMIN_COLUMN_IDS.email,
      accessorKey: 'email',
      header: admin.users.table.columns.email,
      size: 185,
      cell: ({ row }) => (
        <span className="block max-w-full truncate" title={row.original.email}>
          {row.original.email}
        </span>
      ),
    },
    {
      id: USER_ADMIN_COLUMN_IDS.status,
      accessorKey: 'status',
      header: admin.users.table.columns.status,
      size: 100,
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={
            row.original.status === 'ACTIVE'
              ? admin.users.status.active
              : admin.users.status.inactive
          }
        />
      ),
    },
    {
      id: USER_ADMIN_COLUMN_IDS.orgUnit,
      accessorFn: (row) => row.primaryOrgUnit?.name ?? '',
      header: admin.users.table.columns.orgUnitHeader,
      enableSorting: false,
      size: 145,
      cell: ({ row }) =>
        row.original.primaryOrgUnit ? (
          <span
            className="block max-w-full truncate text-muted-foreground"
            title={row.original.primaryOrgUnit.name}
          >
            {row.original.primaryOrgUnit.name}
          </span>
        ) : (
          <EmptyValue>{admin.users.table.noOrgUnit}</EmptyValue>
        ),
    },
    {
      id: USER_ADMIN_COLUMN_IDS.roles,
      accessorFn: (row) =>
        row.roles.flatMap((role) => [roleDisplayName(role.name), role.name]).join(', '),
      header: admin.users.table.columns.roles,
      enableSorting: false,
      size: 195,
      cell: ({ row }) => <UserRoleBadges roles={row.original.roles} widthBudget={175} />,
    },
    {
      id: USER_ADMIN_COLUMN_IDS.lastLoginAt,
      accessorFn: (row) => row.lastLoginAt ?? '',
      header: admin.users.table.columns.lastLoginAt,
      size: 170,
      cell: ({ row }) =>
        row.original.lastLoginAt ? (
          <span className="block truncate whitespace-nowrap text-muted-foreground">
            {new Date(row.original.lastLoginAt).toLocaleString('pt-BR')}
          </span>
        ) : (
          <EmptyValue>{admin.users.table.neverLoggedIn}</EmptyValue>
        ),
    },
  ];

  if (canManageUsers || canManageRoles) {
    columns.push({
      id: USER_ADMIN_COLUMN_IDS.actions,
      header: '',
      enableSorting: false,
      enableHiding: false,
      size: 56,
      cell: ({ row }) => (
        <UserRowActionsMenu
          user={row.original}
          currentUserId={currentUserId}
          canManageUsers={canManageUsers}
          canManageRoles={canManageRoles}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onResetPassword={onResetPassword}
          onRevokeSessions={onRevokeSessions}
          onManageRoles={onManageRoles}
        />
      ),
    });
  }

  return columns;
}
