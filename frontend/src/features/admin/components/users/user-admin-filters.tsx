'use client';

import { useEffect, useState } from 'react';

import { ReferenceDataError } from '@/components/register/reference-data-error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { admin } from '@/lib/messages/admin';
import { common } from '@/lib/messages/common';
import { searchChip, singleValueChip } from '@/lib/register/filter-chips';
import { roleDisplayName } from '@/lib/role-display-name';
import { FilterBar, type ActiveFilterChip } from '@vertice/design-system/components';

import { adminApi } from '../../api';

import type { AdminUserStatus, OrgUnitNode, Role } from '../../types';

const ALL_VALUE = '__all__';

export interface UserAdminFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  status: AdminUserStatus | undefined;
  onStatusChange: (value: AdminUserStatus | undefined) => void;
  orgUnitId: string | undefined;
  onOrgUnitIdChange: (value: string | undefined) => void;
  roleId: string | undefined;
  onRoleIdChange: (value: string | undefined) => void;
  orgUnits: readonly OrgUnitNode[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
  onClearFilters: () => void;
}

export function UserAdminFilters({
  searchValue,
  onSearchChange,
  status,
  onStatusChange,
  orgUnitId,
  onOrgUnitIdChange,
  roleId,
  onRoleIdChange,
  orgUnits,
  hasActiveFilters,
  activeFilterCount,
  onClearFilters,
}: UserAdminFiltersProps): React.JSX.Element {
  const filters = admin.users.filters;
  const chipLabels = admin.users.activeFilters;

  const [roles, setRoles] = useState<readonly Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoadingRoles(true);
      setRolesError(false);
      try {
        const page = await adminApi.listRoles(1, 100);
        if (!cancelled) setRoles(page.data);
      } catch {
        if (!cancelled) setRolesError(true);
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const activeFilterChips: ActiveFilterChip[] = [
    searchChip(searchValue, () => onSearchChange(''), chipLabels),
    singleValueChip(
      'status',
      filters.statusLabel,
      status ? (status === 'ACTIVE' ? filters.statusActive : filters.statusInactive) : undefined,
      () => onStatusChange(undefined),
      chipLabels,
    ),
    singleValueChip(
      'orgUnit',
      filters.orgUnitLabel,
      orgUnitId ? (orgUnits.find((unit) => unit.id === orgUnitId)?.name ?? orgUnitId) : undefined,
      () => onOrgUnitIdChange(undefined),
      chipLabels,
    ),
    singleValueChip(
      'role',
      filters.roleLabel,
      roleId
        ? roleDisplayName(roles.find((role) => role.id === roleId)?.name ?? roleId)
        : undefined,
      () => onRoleIdChange(undefined),
      chipLabels,
    ),
  ].filter((chip): chip is ActiveFilterChip => chip !== null);

  return (
    <>
      {rolesError ? (
        <ReferenceDataError
          message={filters.optionsError}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}
      <FilterBar
        label={filters.regionLabel}
        searchLabel={filters.searchLabel}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={filters.searchPlaceholder}
        collapsible
        filtersToggleLabel={filters.groupLabel}
        filtersPanelLabel={filters.regionLabel}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={common.actions.clearFilters}
        activeFilters={activeFilterChips}
        activeFiltersLabel={chipLabels.regionLabel}
        activeFilterCount={activeFilterCount}
      >
        <Select
          value={status ?? ALL_VALUE}
          onValueChange={(value) =>
            onStatusChange(value === ALL_VALUE ? undefined : (value as AdminUserStatus))
          }
        >
          <SelectTrigger aria-label={filters.statusLabel} className="h-9 w-full sm:w-[12rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{filters.statusAll}</SelectItem>
            <SelectItem value="ACTIVE">{filters.statusActive}</SelectItem>
            <SelectItem value="INACTIVE">{filters.statusInactive}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={orgUnitId ?? ALL_VALUE}
          onValueChange={(value) => onOrgUnitIdChange(value === ALL_VALUE ? undefined : value)}
        >
          <SelectTrigger aria-label={filters.orgUnitLabel} className="h-9 w-full sm:w-[14rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{filters.orgUnitAllOption}</SelectItem>
            {orgUnits.map((unit) => (
              <SelectItem key={unit.id} value={unit.id}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={roleId ?? ALL_VALUE}
          onValueChange={(value) => onRoleIdChange(value === ALL_VALUE ? undefined : value)}
          disabled={loadingRoles}
        >
          <SelectTrigger aria-label={filters.roleLabel} className="h-9 w-full sm:w-[14rem]">
            <SelectValue placeholder={loadingRoles ? filters.loadingOptions : undefined} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>{filters.roleAllOption}</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                {roleDisplayName(role.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>
    </>
  );
}
