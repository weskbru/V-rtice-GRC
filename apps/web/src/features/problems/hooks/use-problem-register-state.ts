'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { ProblemSeverity, ProblemStatus } from '../types';

export const REGISTER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
export type ProblemSortField =
  'code' | 'title' | 'severity' | 'status' | 'identifiedOn' | 'updatedAt';
const DEFAULT_SORT: ProblemSortField = 'identifiedOn';
const DEFAULT_DIRECTION: 'asc' | 'desc' = 'desc';
const DEFAULT_VIEW: ProblemRegisterView = 'cards';

const SORTABLE_FIELDS: readonly ProblemSortField[] = [
  'code',
  'title',
  'severity',
  'status',
  'identifiedOn',
  'updatedAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<ProblemStatus>([
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
]);
const VALID_SEVERITIES: ReadonlySet<string> = new Set<ProblemSeverity>([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

function parseCsv(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseStatusList(value: string | null): readonly ProblemStatus[] {
  return parseCsv(value).filter((entry): entry is ProblemStatus => VALID_STATUSES.has(entry));
}

function parseSeverityList(value: string | null): readonly ProblemSeverity[] {
  return parseCsv(value).filter((entry): entry is ProblemSeverity => VALID_SEVERITIES.has(entry));
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (REGISTER_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): ProblemSortField {
  return SORTABLE_FIELDS.includes(value as ProblemSortField)
    ? (value as ProblemSortField)
    : DEFAULT_SORT;
}

export type ProblemRegisterView = 'cards' | 'table';

export interface ProblemRegisterUrlState {
  search: string;
  page: number;
  pageSize: number;
  sort: ProblemSortField;
  direction: 'asc' | 'desc';
  status: readonly ProblemStatus[];
  severity: readonly ProblemSeverity[];
  view: ProblemRegisterView;
}

export interface UseProblemRegisterStateResult {
  state: ProblemRegisterUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setStatus: (values: readonly ProblemStatus[]) => void;
  setSeverity: (values: readonly ProblemSeverity[]) => void;
  setSort: (field: ProblemSortField, direction: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: ProblemRegisterView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useProblemRegisterState(): UseProblemRegisterStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlSearch = searchParams.get('search') ?? '';

  const state: ProblemRegisterUrlState = {
    search: urlSearch,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'asc' ? 'asc' : DEFAULT_DIRECTION,
    status: parseStatusList(searchParams.get('status')),
    severity: parseSeverityList(searchParams.get('severity')),
    view: searchParams.get('view') === 'table' ? 'table' : DEFAULT_VIEW,
  };

  function setCsvFilter(key: string, values: readonly string[]): void {
    commit((params) => {
      if (values.length > 0) {
        params.set(key, values.join(','));
      } else {
        params.delete(key);
      }
    });
  }

  const {
    inputValue: searchInputValue,
    setValue: setSearch,
    clear: clearSearchInput,
  } = useDebouncedSearchParam(urlSearch, 'search', commit);

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
    (field: ProblemSortField, direction: 'asc' | 'desc') => {
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
    (view: ProblemRegisterView) => {
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
      for (const key of ['search', 'status', 'severity']) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount =
    (state.search !== '' ? 1 : 0) +
    (state.status.length > 0 ? 1 : 0) +
    (state.severity.length > 0 ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    setSearch,
    setStatus: (values) => setCsvFilter('status', values),
    setSeverity: (values) => setCsvFilter('severity', values),
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
