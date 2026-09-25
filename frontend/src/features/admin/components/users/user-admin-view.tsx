'use client';

import {
  ColumnVisibilityMenu,
  DataTable,
  PageHeader,
  PaginationFooter,
  ResultsToolbar,
  ViewToggle,
  type SortingState,
  type VisibilityState,
} from '@pharos/design-system/components';
import { LayoutGrid, Plus, Rows3 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SortSelect } from '@/components/register/sort-select';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { usePermissions } from '@/lib/permissions';

import { adminApi } from '../../api';
import { useUserAdminState, USER_ADMIN_PAGE_SIZE_OPTIONS } from '../../hooks/use-user-admin-state';

import { UserAdminCardGrid } from './user-admin-card-grid';
import { USER_ADMIN_HIDEABLE_COLUMNS, buildUserAdminColumns } from './user-admin-columns';
import { UserAdminEmpty } from './user-admin-empty';
import { UserAdminFilters } from './user-admin-filters';
import { UserAdminSummary } from './user-admin-summary';
import { UserCreateDialog } from './user-create-dialog';
import { UserEditDialog } from './user-edit-dialog';
import { UserPasswordDialog } from './user-password-dialog';
import { UserRolesDialog } from './user-roles-dialog';
import { UserSessionsDialog } from './user-sessions-dialog';
import { UserStatusDialog } from './user-status-dialog';

import type { UserAdminView as ViewMode } from '../../hooks/use-user-admin-state';
import type { AdminUser, AdminUserSortField, OrgUnitNode } from '../../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const VIEW_OPTIONS = [
  {
    value: 'cards' as const,
    label: admin.users.view.cards,
    icon: LayoutGrid,
    accessibleLabel: admin.users.view.cardsLabel,
  },
  {
    value: 'table' as const,
    label: admin.users.view.table,
    icon: Rows3,
    accessibleLabel: admin.users.view.tableLabel,
  },
];

export function UserAdminView(): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
  const canManageUsers = hasPermission('user:administer');
  const canManageRoles = hasPermission('role:administer');

  const {
    state,
    searchInputValue,
    setSearch,
    setStatus,
    setOrgUnitId,
    setRoleId,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  } = useUserAdminState();

  const [orgUnits, setOrgUnits] = useState<readonly OrgUnitNode[]>([]);
  const [rows, setRows] = useState<readonly AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [statusUser, setStatusUser] = useState<AdminUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [sessionsUser, setSessionsUser] = useState<AdminUser | null>(null);
  const [rolesUser, setRolesUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    adminApi
      .listOrgUnits('ACTIVE')
      .then(setOrgUnits)
      .catch(() => setOrgUnits([]));
  }, []);

  const requestKey = [
    state.page,
    state.pageSize,
    state.q,
    state.sort,
    state.direction,
    state.status ?? '',
    state.orgUnitId ?? '',
    state.roleId ?? '',
    reloadToken,
  ].join('|');
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null);
  const loading = resolvedRequestKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listUsers({
        page: state.page,
        pageSize: state.pageSize,
        q: state.q || undefined,
        status: state.status,
        orgUnitId: state.orgUnitId,
        roleId: state.roleId,
        sort: state.sort,
        direction: state.direction,
      })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setTotal(result.meta.total);
        setTotalPages(Math.max(1, result.meta.totalPages));
        setError(undefined);
        setResolvedRequestKey(requestKey);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiError) {
          setError({
            title: caught.problem.title,
            detail: caught.problem.detail,
            correlationId: caught.problem.correlationId,
          });
        } else {
          setError({});
        }
        setResolvedRequestKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `requestKey` deriva dos filtros listados; repeti-los causaria nova busca.
  }, [requestKey]);

  useEffect(() => {
    if (!loading && state.page > totalPages) {
      setPage(totalPages);
    }
  }, [loading, state.page, totalPages, setPage]);

  function reload(): void {
    setReloadToken((token) => token + 1);
  }

  const columns = buildUserAdminColumns({
    currentUserId: currentUser.id,
    canManageUsers,
    canManageRoles,
    onEdit: setEditingUser,
    onToggleStatus: setStatusUser,
    onResetPassword: setPasswordUser,
    onRevokeSessions: setSessionsUser,
    onManageRoles: setRolesUser,
  });

  const sorting: SortingState = [{ id: state.sort, desc: state.direction === 'desc' }];

  function handleSortingChange(next: SortingState): void {
    const first = next[0];
    if (!first) {
      setSort('fullName', 'asc');
      return;
    }
    setSort(first.id as AdminUserSortField, first.desc ? 'desc' : 'asc');
  }

  const emptyContent = (
    <UserAdminEmpty
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      canCreateUser={canManageUsers}
      onCreateUser={() => setCreateOpen(true)}
    />
  );
  const errorAction = (
    <Button variant="outline" onClick={reload}>
      {common.actions.retry}
    </Button>
  );

  const isCardView = state.view === 'cards';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={admin.users.pageTitle}
        description={admin.users.pageDescription}
        actions={
          canManageUsers ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              {admin.users.createAction}
            </Button>
          ) : null
        }
      />

      <UserAdminSummary canManageRoles={canManageRoles} />

      <UserAdminFilters
        searchValue={searchInputValue}
        onSearchChange={setSearch}
        status={state.status}
        onStatusChange={setStatus}
        orgUnitId={state.orgUnitId}
        onOrgUnitIdChange={setOrgUnitId}
        roleId={state.roleId}
        onRoleIdChange={setRoleId}
        orgUnits={orgUnits}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
      />

      <ResultsToolbar
        count={admin.users.results.count(total)}
        isLoading={loading}
        loadingLabel={admin.users.results.countLoading}
      >
        <SortSelect
          labels={admin.users.results}
          prefix={admin.users.results.sortLabel}
          sort={state.sort}
          direction={state.direction}
          onSortChange={setSort}
          triggerClassName="w-[15rem]"
        />

        <ViewToggle
          label={admin.users.view.groupLabel}
          options={VIEW_OPTIONS}
          value={state.view}
          onChange={(value: ViewMode) => setView(value)}
        />

        {!isCardView ? (
          <ColumnVisibilityMenu
            label={admin.users.filters.columnsMenuLabel}
            columns={USER_ADMIN_HIDEABLE_COLUMNS}
            visibility={columnVisibility}
            onChange={setColumnVisibility}
          />
        ) : null}
      </ResultsToolbar>

      {isCardView ? (
        <div className="flex flex-col gap-4">
          <UserAdminCardGrid
            users={rows}
            currentUserId={currentUser.id}
            canManageUsers={canManageUsers}
            canManageRoles={canManageRoles}
            onEdit={setEditingUser}
            onToggleStatus={setStatusUser}
            onResetPassword={setPasswordUser}
            onRevokeSessions={setSessionsUser}
            onManageRoles={setRolesUser}
            isLoading={loading}
            emptyContent={emptyContent}
            error={error}
            errorAction={errorAction}
          />

          {!error && rows.length > 0 ? (
            <PaginationFooter
              pageIndex={state.page - 1}
              pageSize={state.pageSize}
              totalRows={total}
              pageSizeOptions={USER_ADMIN_PAGE_SIZE_OPTIONS}
              onPageIndexChange={(index) => setPage(index + 1)}
              onPageSizeChange={setPageSize}
              labels={common.dataTable}
            />
          ) : null}
        </div>
      ) : (
        <DataTable<AdminUser>
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          pageIndex={state.page - 1}
          pageSize={state.pageSize}
          totalRows={total}
          pageSizeOptions={USER_ADMIN_PAGE_SIZE_OPTIONS}
          onPageIndexChange={(index) => setPage(index + 1)}
          onPageSizeChange={setPageSize}
          columnVisibility={columnVisibility}
          labels={common.dataTable}
          layout="fixed"
          stickyFirstColumn
          isLoading={loading}
          error={error}
          errorAction={errorAction}
          emptyContent={emptyContent}
          caption={admin.users.table.caption}
        />
      )}

      {canManageUsers ? (
        <UserCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          orgUnits={orgUnits}
          onCreated={() => {
            feedback.success(admin.users.feedback.createSuccess);
            reload();
          }}
        />
      ) : null}

      {canManageUsers && editingUser ? (
        <UserEditDialog
          open={editingUser !== null}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          user={editingUser}
          orgUnits={orgUnits}
          onSaved={() => {
            setEditingUser(null);
            feedback.success(admin.users.feedback.updateSuccess);
            reload();
          }}
        />
      ) : null}

      {canManageUsers ? (
        <UserStatusDialog
          user={statusUser}
          onOpenChange={(open) => {
            if (!open) setStatusUser(null);
          }}
          onConfirm={(target) =>
            adminApi.setUserStatus(target.id, {
              status: target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            })
          }
          onChanged={(updated) => {
            setStatusUser(null);
            feedback.success(
              updated.status === 'ACTIVE'
                ? admin.users.feedback.activateSuccess
                : admin.users.feedback.deactivateSuccess,
            );
            reload();
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}

      {canManageUsers ? (
        <UserPasswordDialog
          user={passwordUser}
          onOpenChange={(open) => {
            if (!open) setPasswordUser(null);
          }}
          onReset={() => {
            setPasswordUser(null);
            feedback.success(admin.users.feedback.passwordResetSuccess);
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}

      {canManageUsers ? (
        <UserSessionsDialog
          user={sessionsUser}
          onOpenChange={(open) => {
            if (!open) setSessionsUser(null);
          }}
          onRevoked={() => {
            setSessionsUser(null);
            feedback.success(admin.users.feedback.sessionsRevokedSuccess);
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}

      {canManageRoles ? (
        <UserRolesDialog
          user={rolesUser}
          onOpenChange={(open) => {
            if (!open) setRolesUser(null);
          }}
          onSaved={() => {
            setRolesUser(null);
            feedback.success(admin.users.feedback.rolesUpdatedSuccess);
            reload();
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}
    </div>
  );
}
