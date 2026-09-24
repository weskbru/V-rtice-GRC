'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { AdminUserSortField, AdminUserStatus } from '../types';

export const USER_ADMIN_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT: AdminUserSortField = 'fullName';
type SortDirection = 'asc' | 'desc';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_VIEW: UserAdminView = 'table';

const SORTABLE_FIELDS: readonly AdminUserSortField[] = [
  'fullName',
  'email',
  'status',
  'lastLoginAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<AdminUserStatus>(['ACTIVE', 'INACTIVE']);

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (USER_ADMIN_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): AdminUserSortField {
  return SORTABLE_FIELDS.includes(value as AdminUserSortField)
    ? (value as AdminUserSortField)
    : DEFAULT_SORT;
}

function parseStatus(value: string | null): AdminUserStatus | undefined {
  return value && VALID_STATUSES.has(value) ? (value as AdminUserStatus) : undefined;
}

function parseSingleValue(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

export type UserAdminView = 'cards' | 'table';

export interface UserAdminUrlState {
  q: string;
  page: number;
  pageSize: number;
  sort: AdminUserSortField;
  direction: SortDirection;
  status: AdminUserStatus | undefined;
  orgUnitId: string | undefined;
  roleId: string | undefined;
  view: UserAdminView;
}

export interface UseUserAdminStateResult {
  state: UserAdminUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setStatus: (value: AdminUserStatus | undefined) => void;
  setOrgUnitId: (value: string | undefined) => void;
  setRoleId: (value: string | undefined) => void;
  setSort: (field: AdminUserSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: UserAdminView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useUserAdminState(): UseUserAdminStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: UserAdminUrlState = {
    q: urlQ,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    status: parseStatus(searchParams.get('status')),
    orgUnitId: parseSingleValue(searchParams.get('orgUnitId')),
    roleId: parseSingleValue(searchParams.get('roleId')),
    view: searchParams.get('view') === 'cards' ? 'cards' : DEFAULT_VIEW,
  };

  const {
    inputValue: searchInputValue,
    setValue: setSearch,
    clear: clearSearchInput,
  } = useDebouncedSearchParam(urlQ, 'q', commit);

  function setSingleFilter(key: string, value: string | undefined): void {
    commit((params) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
  }

  const setPage = useCallback(
    (page: number) => {
      commit((params) => {
        if (page > 1) {
          params.set('page', String(page));
        } else {
          params.delete('page');
        }
      }, false);
    },
    [commit],
  );

  const setPageSize = useCallback(
    (size: number) => {
      commit((params) => {
        if (size !== DEFAULT_PAGE_SIZE) {
          params.set('pageSize', String(size));
        } else {
          params.delete('pageSize');
        }
        params.delete('page');
      }, false);
    },
    [commit],
  );

  const setSort = useCallback(
    (field: AdminUserSortField, direction: SortDirection) => {
      commit((params) => {
        if (field === DEFAULT_SORT) {
          params.delete('sort');
        } else {
          params.set('sort', field);
        }
        if (direction === DEFAULT_DIRECTION) {
          params.delete('direction');
        } else {
          params.set('direction', direction);
        }
      });
    },
    [commit],
  );

  const setView = useCallback(
    (view: UserAdminView) => {
      commit((params) => {
        if (view === DEFAULT_VIEW) {
          params.delete('view');
        } else {
          params.set('view', view);
        }
      }, false);
    },
    [commit],
  );

  const clearFilters = useCallback(() => {
    clearSearchInput();
    commit((params) => {
      for (const key of ['q', 'status', 'orgUnitId', 'roleId']) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount =
    (state.q !== '' ? 1 : 0) +
    (state.status !== undefined ? 1 : 0) +
    (state.orgUnitId !== undefined ? 1 : 0) +
    (state.roleId !== undefined ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setStatus: (value) => setSingleFilter('status', value),
    setOrgUnitId: (value) => setSingleFilter('orgUnitId', value),
    setRoleId: (value) => setSingleFilter('roleId', value),
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
