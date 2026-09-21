'use client';

/**
 * PharosGRC — Administration, the roles surface's URL state
 * (015-roles-permissions-surface FR-005, NFR-007).
 *
 * The query string IS this screen's state — the same rule every register in
 * the product follows, and through the same shared mechanism
 * (`@/lib/register/url-state`): one change committed to the CURRENT query
 * string with `router.replace`, a debounced search box that cannot lose a
 * filter changed mid-debounce, and no default ever written into the URL.
 *
 * What differs from a register hook is what is NOT here: no `page`, no
 * `pageSize`, no `sort`/`direction` pair. `GET /admin/roles` accepts only
 * `page` and `pageSize` and returns a bounded set in one page (research.md
 * R-009), so search, kind, module and ordering are all applied client-side
 * over what the screen already holds (`role-filtering.ts`) and reach the URL
 * purely so a filtered view is shareable and survives Back/Forward.
 *
 * Writing this query string is deliberately NOT routed through
 * `useNavigate`: it is the current screen's own filter state, not a
 * navigation, and treating it as one would raise the page-level
 * institutional loader over every keystroke (specs/014-institutional-loader
 * §2.3). The `useRouter` import that policy restricts lives in the shared
 * module, not here — this hook only reads `useSearchParams`.
 */
// Reads the current screen's own query string; the write side (and the
// restricted `useRouter` import) lives in `@/lib/register/url-state`.
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

/** An unknown or removed area in the URL degrades to "every module" rather than to an empty list nobody can explain. */
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
  /** The search box's live value — always current, even before the debounced URL commit fires. */
  readonly searchInputValue: string;
  readonly setSearch: (value: string) => void;
  /** Drops the search term at once — the debounce would otherwise leave the chip a third of a second behind the click that removed it. */
  readonly clearSearch: () => void;
  readonly setType: (value: RoleTypeFilter) => void;
  readonly setModule: (value: PermissionArea | undefined) => void;
  readonly setSort: (value: RoleSortOption) => void;
  readonly clearFilters: () => void;
  readonly hasActiveFilters: boolean;
  /** How many filter FIELDS narrow the list right now — ordering is not one of them; it reorders, it never hides a role. */
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
