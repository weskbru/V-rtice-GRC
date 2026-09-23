'use client';

import { PageHeader, ResultsToolbar } from '@pharos/design-system/components';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ToolbarSelect } from '@/components/register/toolbar-select';
import { feedback } from '@/components/shell/feedback-provider';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { admin } from '@/lib/messages/admin';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

import { adminApi } from '../../api';

import { PERMISSION_AREA_ORDER } from './permission-grouping';
import { RoleAdminSummary } from './role-admin-summary';
import { RoleCardList } from './role-card-list';
import { RoleCreatePanel } from './role-create-panel';
import { RoleDeleteDialog } from './role-delete-dialog';
import { RoleDetailPanel } from './role-detail-panel';
import { RoleFilterBar } from './role-filter-bar';
import { applyRoleCriteria, roleModuleReach } from './role-filtering';
import { useRoleSurfaceState } from './use-role-surface-state';

import type { PermissionArea } from './permission-grouping';
import type { Role, RoleSortOption, RolesSummary } from '../../types';
import type { ErrorStateProblem } from '@pharos/design-system/components';

const PAGE_SIZE = 100;

export function RoleAdminView(): React.JSX.Element {
  const { hasPermission } = usePermissions();
  const canManageRoles = hasPermission('role:administer');
  const canAdministerUsers = hasPermission('user:administer');
  const canManageOrgUnits = hasPermission('org_unit:administer');

  const surface = useRoleSurfaceState();

  const [rows, setRows] = useState<readonly Role[]>([]);
  const [error, setError] = useState<ErrorStateProblem | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const [summary, setSummary] = useState<RolesSummary | null>(null);
  const [summaryError, setSummaryError] = useState(false);

  const [creating, setCreating] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const [resolvedReloadToken, setResolvedReloadToken] = useState<number | null>(null);
  const loading = resolvedReloadToken !== reloadToken;

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listRoles(1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setError(undefined);
        setResolvedReloadToken(reloadToken);
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
        setResolvedReloadToken(reloadToken);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getRolesSummary()
      .then((result) => {
        if (cancelled) return;
        setSummary(result);
        setSummaryError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSummaryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function reload(): void {
    setReloadToken((token) => token + 1);
  }

  const visibleRoles = useMemo(
    () =>
      applyRoleCriteria(
        rows,
        { q: surface.state.q, type: surface.state.type, module: surface.state.module },
        surface.state.sort,
      ),
    [rows, surface.state.q, surface.state.type, surface.state.module, surface.state.sort],
  );

  const availableModules = useMemo(() => {
    const labels = new Map<PermissionArea, string>();
    for (const role of rows) {
      for (const reach of roleModuleReach(role)) {
        labels.set(reach.area, reach.label);
      }
    }
    return PERMISSION_AREA_ORDER.filter((area) => labels.has(area)).map((area) => ({
      area,
      label: labels.get(area) ?? area,
    }));
  }, [rows]);

  const selectedRole = rows.find((role) => role.id === selectedRoleId) ?? null;

  function startCreating(): void {
    setSelectedRoleId(null);
    setCreating(true);
  }

  function selectRole(role: Role): void {
    setCreating(false);
    setSelectedRoleId(role.id);
  }

  const createAction = canManageRoles ? (
    <Button onClick={startCreating}>
      <Plus aria-hidden="true" className="size-4" />
      {admin.roles.createAction}
    </Button>
  ) : null;

  const isFiltered = surface.hasActiveFilters;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={admin.roles.pageTitle}
        description={admin.roles.pageDescription}
        actions={createAction}
      />

      <RoleAdminSummary
        summary={summary}
        isLoading={summary === null && !summaryError}
        hasError={summaryError}
        activeType={surface.state.type}
        onSelectType={surface.setType}
      />

      <RoleFilterBar
        searchValue={surface.searchInputValue}
        onSearchChange={surface.setSearch}
        onClearSearch={surface.clearSearch}
        type={surface.state.type}
        onTypeChange={surface.setType}
        module={surface.state.module}
        onModuleChange={surface.setModule}
        availableModules={availableModules}
        hasActiveFilters={surface.hasActiveFilters}
        activeFilterCount={surface.activeFilterCount}
        onClearFilters={surface.clearFilters}
      />

      <ResultsToolbar
        count={
          isFiltered
            ? admin.roles.results.countOfTotal(visibleRoles.length, rows.length)
            : admin.roles.results.count(visibleRoles.length)
        }
        isLoading={loading}
        loadingLabel={admin.roles.results.countLoading}
      >
        <ToolbarSelect
          label={admin.roles.results.sortLabel}
          prefix={admin.roles.results.sortLabel}
          options={Object.entries(admin.roles.results.sortOptions).map(([value, label]) => ({
            value,
            label,
          }))}
          value={surface.state.sort}
          onValueChange={(value) => surface.setSort(value as RoleSortOption)}
          triggerClassName="w-[15rem] max-w-full"
        />
      </ResultsToolbar>

      <div
        className={cn(
          'grid grid-cols-1 items-start gap-4',
          (selectedRole !== null || creating) && 'xl:grid-cols-[minmax(0,1fr)_26rem]',
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <RoleCardList
            roles={visibleRoles}
            totalRoles={rows.length}
            selectedRoleId={selectedRoleId}
            onSelect={selectRole}
            isLoading={loading}
            error={error}
            onRetry={reload}
            onClearFilters={surface.clearFilters}
            createAction={createAction}
          />
        </div>

        {creating && canManageRoles ? (
          <RoleCreatePanel
            onClose={() => setCreating(false)}
            onCreated={(created) => {
              setCreating(false);
              feedback.success(admin.roles.feedback.createSuccess);
              setSelectedRoleId(created.id);
              reload();
            }}
          />
        ) : null}

        {selectedRole ? (
          <RoleDetailPanel
            key={selectedRole.id}
            role={selectedRole}
            canManageRoles={canManageRoles}
            canAdministerUsers={canAdministerUsers}
            canManageOrgUnits={canManageOrgUnits}
            onClose={() => setSelectedRoleId(null)}
            onSaved={() => {
              feedback.success(admin.roles.feedback.updateSuccess);
              reload();
            }}
            onDelete={setDeletingRole}
          />
        ) : null}
      </div>

      {canManageRoles ? (
        <RoleDeleteDialog
          role={deletingRole}
          onOpenChange={(open) => {
            if (!open) setDeletingRole(null);
          }}
          onDeleted={() => {
            setSelectedRoleId(null);
            setDeletingRole(null);
            feedback.success(admin.roles.feedback.deleteSuccess);
            reload();
          }}
          onError={(message) => feedback.error(message)}
        />
      ) : null}
    </div>
  );
}
