'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type {
  ControlEffectiveness,
  ControlFrequency,
  ControlNature,
  ControlRegisterSortField,
  ControlStatus,
  ControlType,
  SortDirection,
} from '../types';

export const CATALOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT: ControlRegisterSortField = 'code';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_VIEW: ControlCatalogView = 'cards';

const SORTABLE_FIELDS: readonly ControlRegisterSortField[] = [
  'code',
  'name',
  'status',
  'effectiveness',
  'owner',
  'updatedAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<ControlStatus>([
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
]);
const VALID_EFFECTIVENESS: ReadonlySet<string> = new Set<ControlEffectiveness>([
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
]);
const VALID_NATURE: ReadonlySet<string> = new Set<ControlNature>(['MANUAL', 'AUTOMATED']);
const VALID_TYPE: ReadonlySet<string> = new Set<ControlType>([
  'PREVENTIVE',
  'DETECTIVE',
  'CORRECTIVE',
]);
const VALID_FREQUENCY: ReadonlySet<string> = new Set<ControlFrequency>([
  'CONTINUOUS',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
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
  return (CATALOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): ControlRegisterSortField {
  return SORTABLE_FIELDS.includes(value as ControlRegisterSortField)
    ? (value as ControlRegisterSortField)
    : DEFAULT_SORT;
}

export type ControlCatalogView = 'cards' | 'table';

export interface ControlCatalogUrlState {
  q: string;
  page: number;
  pageSize: number;
  sort: ControlRegisterSortField;
  direction: SortDirection;
  status: readonly ControlStatus[];
  effectiveness: readonly ControlEffectiveness[];
  nature: readonly ControlNature[];
  type: readonly ControlType[];
  frequency: readonly ControlFrequency[];
  orgUnitId: readonly string[];
  ownerUserId: readonly string[];
  view: ControlCatalogView;
}

export interface UseCatalogStateResult {
  state: ControlCatalogUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setStatus: (values: readonly ControlStatus[]) => void;
  setEffectiveness: (values: readonly ControlEffectiveness[]) => void;
  setNature: (values: readonly ControlNature[]) => void;
  setType: (values: readonly ControlType[]) => void;
  setFrequency: (values: readonly ControlFrequency[]) => void;
  setOrgUnitId: (values: readonly string[]) => void;
  setOwnerUserId: (values: readonly string[]) => void;
  setSort: (field: ControlRegisterSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: ControlCatalogView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useCatalogState(): UseCatalogStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: ControlCatalogUrlState = {
    q: urlQ,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    status: parseEnumList(searchParams.get('status'), VALID_STATUSES),
    effectiveness: parseEnumList(searchParams.get('effectiveness'), VALID_EFFECTIVENESS),
    nature: parseEnumList(searchParams.get('nature'), VALID_NATURE),
    type: parseEnumList(searchParams.get('type'), VALID_TYPE),
    frequency: parseEnumList(searchParams.get('frequency'), VALID_FREQUENCY),
    orgUnitId: parseCsv(searchParams.get('orgUnitId')),
    ownerUserId: parseCsv(searchParams.get('ownerUserId')),
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
  } = useDebouncedSearchParam(urlQ, 'q', commit);

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
    (field: ControlRegisterSortField, direction: SortDirection) => {
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
    (view: ControlCatalogView) => {
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
      for (const key of [
        'q',
        'status',
        'effectiveness',
        'nature',
        'type',
        'frequency',
        'orgUnitId',
        'ownerUserId',
      ]) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount =
    (state.q !== '' ? 1 : 0) +
    (state.status.length > 0 ? 1 : 0) +
    (state.effectiveness.length > 0 ? 1 : 0) +
    (state.nature.length > 0 ? 1 : 0) +
    (state.type.length > 0 ? 1 : 0) +
    (state.frequency.length > 0 ? 1 : 0) +
    (state.orgUnitId.length > 0 ? 1 : 0) +
    (state.ownerUserId.length > 0 ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setStatus: (values) => setCsvFilter('status', values),
    setEffectiveness: (values) => setCsvFilter('effectiveness', values),
    setNature: (values) => setCsvFilter('nature', values),
    setType: (values) => setCsvFilter('type', values),
    setFrequency: (values) => setCsvFilter('frequency', values),
    setOrgUnitId: (values) => setCsvFilter('orgUnitId', values),
    setOwnerUserId: (values) => setCsvFilter('ownerUserId', values),
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
