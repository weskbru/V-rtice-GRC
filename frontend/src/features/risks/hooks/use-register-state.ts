'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type {
  RiskLevel,
  RiskLevelBasis,
  RiskRegisterSortField,
  RiskStatus,
  SortDirection,
} from '../types';

export const REGISTER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_SORT: RiskRegisterSortField = 'code';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_BASIS: RiskLevelBasis = 'RESIDUAL';
const DEFAULT_VIEW: RiskRegisterView = 'cards';

const SORTABLE_FIELDS: readonly RiskRegisterSortField[] = [
  'code',
  'title',
  'riskLevel',
  'status',
  'owner',
  'nextReviewOn',
  'identifiedOn',
  'updatedAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<RiskStatus>([
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
]);
const VALID_LEVELS: ReadonlySet<string> = new Set<RiskLevel>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function parseCsv(value: string | null): readonly string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseStatusList(value: string | null): readonly RiskStatus[] {
  return parseCsv(value).filter((entry): entry is RiskStatus => VALID_STATUSES.has(entry));
}

function parseLevelList(value: string | null): readonly RiskLevel[] {
  return parseCsv(value).filter((entry): entry is RiskLevel => VALID_LEVELS.has(entry));
}

function parseBooleanFlag(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
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

function parseSort(value: string | null): RiskRegisterSortField {
  return SORTABLE_FIELDS.includes(value as RiskRegisterSortField)
    ? (value as RiskRegisterSortField)
    : DEFAULT_SORT;
}

export type RiskRegisterView = 'cards' | 'table';

export interface RiskRegisterUrlState {
  q: string;
  page: number;
  pageSize: number;
  sort: RiskRegisterSortField;
  direction: SortDirection;
  status: readonly RiskStatus[];
  riskLevel: readonly RiskLevel[];
  riskLevelBasis: RiskLevelBasis;
  categoryId: readonly string[];
  orgUnitId: readonly string[];
  ownerUserId: readonly string[];
  overdueReview?: boolean;
  overdueTreatment?: boolean;
  view: RiskRegisterView;
}

export interface UseRegisterStateResult {
  state: RiskRegisterUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setStatus: (values: readonly RiskStatus[]) => void;
  setRiskLevel: (values: readonly RiskLevel[]) => void;
  setRiskLevelBasis: (basis: RiskLevelBasis) => void;
  setCategoryId: (values: readonly string[]) => void;
  setOrgUnitId: (values: readonly string[]) => void;
  setOwnerUserId: (values: readonly string[]) => void;
  setOverdueReview: (value: boolean | undefined) => void;
  setOverdueTreatment: (value: boolean | undefined) => void;
  setSort: (field: RiskRegisterSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: RiskRegisterView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useRegisterState(): UseRegisterStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: RiskRegisterUrlState = {
    q: urlQ,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    status: parseStatusList(searchParams.get('status')),
    riskLevel: parseLevelList(searchParams.get('riskLevel')),
    riskLevelBasis: searchParams.get('riskLevelBasis') === 'INHERENT' ? 'INHERENT' : DEFAULT_BASIS,
    categoryId: parseCsv(searchParams.get('categoryId')),
    orgUnitId: parseCsv(searchParams.get('orgUnitId')),
    ownerUserId: parseCsv(searchParams.get('ownerUserId')),
    overdueReview: parseBooleanFlag(searchParams.get('overdueReview')),
    overdueTreatment: parseBooleanFlag(searchParams.get('overdueTreatment')),
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
    (field: RiskRegisterSortField, direction: SortDirection) => {
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

  const setRiskLevelBasis = useCallback(
    (basis: RiskLevelBasis) => {
      commit((params) => {
        if (basis === DEFAULT_BASIS) {
          params.delete('riskLevelBasis');
        } else {
          params.set('riskLevelBasis', basis);
        }
      });
    },
    [commit],
  );

  const setOverdueReview = useCallback(
    (value: boolean | undefined) => {
      commit((params) => {
        if (value === undefined) {
          params.delete('overdueReview');
        } else {
          params.set('overdueReview', String(value));
        }
      });
    },
    [commit],
  );

  const setOverdueTreatment = useCallback(
    (value: boolean | undefined) => {
      commit((params) => {
        if (value === undefined) {
          params.delete('overdueTreatment');
        } else {
          params.set('overdueTreatment', String(value));
        }
      });
    },
    [commit],
  );

  const setView = useCallback(
    (view: RiskRegisterView) => {
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
        'riskLevel',
        'categoryId',
        'orgUnitId',
        'ownerUserId',
        'overdueReview',
        'overdueTreatment',
      ]) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  const activeFilterCount =
    (state.q !== '' ? 1 : 0) +
    (state.status.length > 0 ? 1 : 0) +
    (state.riskLevel.length > 0 ? 1 : 0) +
    (state.categoryId.length > 0 ? 1 : 0) +
    (state.orgUnitId.length > 0 ? 1 : 0) +
    (state.ownerUserId.length > 0 ? 1 : 0) +
    (state.overdueReview !== undefined ? 1 : 0) +
    (state.overdueTreatment !== undefined ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setStatus: (values) => setCsvFilter('status', values),
    setRiskLevel: (values) => setCsvFilter('riskLevel', values),
    setRiskLevelBasis,
    setCategoryId: (values) => setCsvFilter('categoryId', values),
    setOrgUnitId: (values) => setCsvFilter('orgUnitId', values),
    setOwnerUserId: (values) => setCsvFilter('ownerUserId', values),
    setOverdueReview,
    setOverdueTreatment,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
