'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { FrameworkListSortField, FrameworkOrigin, SortDirection } from '../types';

export const FRAMEWORK_LIST_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT: FrameworkListSortField = 'code';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_VIEW: FrameworkListView = 'cards';

const SORTABLE_FIELDS: readonly FrameworkListSortField[] = ['code', 'name', 'updatedAt'];
const VALID_ORIGIN: ReadonlySet<string> = new Set<FrameworkOrigin>([
  'EXTERNAL_STANDARD',
  'INTERNAL_POLICY',
]);

function parseCsv(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEnumList<T extends string>(
  value: string | null,
  valid: ReadonlySet<string>,
): readonly T[] {
  return parseCsv(value).filter((entry): entry is T => valid.has(entry));
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (FRAMEWORK_LIST_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): FrameworkListSortField {
  return SORTABLE_FIELDS.includes(value as FrameworkListSortField)
    ? (value as FrameworkListSortField)
    : DEFAULT_SORT;
}

export type FrameworkListView = 'cards' | 'table';

export interface FrameworkListUrlState {
  q: string;
  page: number;
  pageSize: number;
  sort: FrameworkListSortField;
  direction: SortDirection;
  origin: readonly FrameworkOrigin[];
  view: FrameworkListView;
}

export interface UseFrameworkListStateResult {
  state: FrameworkListUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setOrigin: (values: readonly FrameworkOrigin[]) => void;
  setSort: (field: FrameworkListSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: FrameworkListView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useFrameworkListState(): UseFrameworkListStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: FrameworkListUrlState = {
    q: urlQ,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    origin: parseEnumList(searchParams.get('origin'), VALID_ORIGIN),
    view: searchParams.get('view') === 'table' ? 'table' : DEFAULT_VIEW,
  };

  const {
    inputValue: searchInputValue,
    setValue: setSearch,
    clear: clearSearchInput,
  } = useDebouncedSearchParam(urlQ, 'q', commit);

  const setOrigin = useCallback(
    (values: readonly FrameworkOrigin[]) => {
      commit((params) => {
        if (values.length > 0) {
          params.set('origin', values.join(','));
        } else {
          params.delete('origin');
        }
      });
    },
    [commit],
  );

  const setSort = useCallback(
    (field: FrameworkListSortField, direction: SortDirection) => {
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

  const setView = useCallback(
    (view: FrameworkListView) => {
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
      for (const key of ['q', 'origin']) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount = (state.q !== '' ? 1 : 0) + (state.origin.length > 0 ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setOrigin,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
