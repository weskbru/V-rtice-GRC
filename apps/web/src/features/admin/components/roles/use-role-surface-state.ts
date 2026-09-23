'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import { PERMISSION_AREA_ORDER } from './permission-grouping';

import type { PermissionArea } from './permission-grouping';
import type { RoleSortOption, RoleTypeFilter } from '../../types';

const DEFAULT_TYPE: RoleTypeFilter = 'all';
const DEFAULT_SORT: RoleSortOption = 'name:asc';

const ROLE_TYPE_FILTERS: readonly RoleTypeFilter[] = ['all', 'system', 'custom'];
const ROLE_SORT_OPTIONS: readonly RoleSortOption[] = [
  'name:asc',
  'name:desc',
  'permissions:desc',
  'users:desc',
];

function parseType(value: string | null): RoleTypeFilter {
  return ROLE_TYPE_FILTERS.includes(value as RoleTypeFilter)
    ? (value as RoleTypeFilter)
    : DEFAULT_TYPE;
}

function parseSort(value: string | null): RoleSortOption {
  return ROLE_SORT_OPTIONS.includes(value as RoleSortOption)
    ? (value as RoleSortOption)
    : DEFAULT_SORT;
}

function parseModule(value: string | null): PermissionArea | undefined {
  return PERMISSION_AREA_ORDER.includes(value as PermissionArea)
    ? (value as PermissionArea)
    : undefined;
}

export interface RoleSurfaceUrlState {
  readonly q: string;
  readonly type: RoleTypeFilter;
  readonly module: PermissionArea | undefined;
  readonly sort: RoleSortOption;
}

export interface UseRoleSurfaceStateResult {
  readonly state: RoleSurfaceUrlState;
  readonly searchInputValue: string;
  readonly setSearch: (value: string) => void;
  readonly clearSearch: () => void;
  readonly setType: (value: RoleTypeFilter) => void;
  readonly setModule: (value: PermissionArea | undefined) => void;
  readonly setSort: (value: RoleSortOption) => void;
  readonly clearFilters: () => void;
  readonly hasActiveFilters: boolean;
  readonly activeFilterCount: number;
}

export function useRoleSurfaceState(): UseRoleSurfaceStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: RoleSurfaceUrlState = {
    q: urlQ,
    type: parseType(searchParams.get('type')),
    module: parseModule(searchParams.get('module')),
    sort: parseSort(searchParams.get('sort')),
  };

  const {
    inputValue: searchInputValue,
    setValue: setSearch,
    clear: clearSearchInput,
  } = useDebouncedSearchParam(urlQ, 'q', commit);

  const setType = useCallback(
    (value: RoleTypeFilter) => {
      commit((params) => {
        if (value === DEFAULT_TYPE) {
          params.delete('type');
        } else {
          params.set('type', value);
        }
      });
    },
    [commit],
  );

  const setModule = useCallback(
    (value: PermissionArea | undefined) => {
      commit((params) => {
        if (value === undefined) {
          params.delete('module');
        } else {
          params.set('module', value);
        }
      });
    },
    [commit],
  );

  const setSort = useCallback(
    (value: RoleSortOption) => {
      commit((params) => {
        if (value === DEFAULT_SORT) {
          params.delete('sort');
        } else {
          params.set('sort', value);
        }
      });
    },
    [commit],
  );

  const clearSearch = useCallback(() => {
    clearSearchInput();
    commit((params) => {
      params.delete('q');
    });
  }, [commit, clearSearchInput]);

  const clearFilters = useCallback(() => {
    clearSearchInput();
    commit((params) => {
      params.delete('q');
      params.delete('type');
      params.delete('module');
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount =
    (state.q !== '' ? 1 : 0) +
    (state.type !== DEFAULT_TYPE ? 1 : 0) +
    (state.module !== undefined ? 1 : 0);

  return {
    state,
    searchInputValue,
    setSearch,
    clearSearch,
    setType,
    setModule,
    setSort,
    clearFilters,
    hasActiveFilters: activeFilterCount > 0,
    activeFilterCount,
  };
}
