'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useUrlQueryCommit } from '@/lib/register/url-state';

import type { AuditEngagementListSortField, AuditEngagementStatus, SortDirection } from '../types';

export const ENGAGEMENT_CATALOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT: AuditEngagementListSortField = 'code';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_VIEW: EngagementCatalogView = 'cards';

const SORTABLE_FIELDS: readonly AuditEngagementListSortField[] = [
  'code',
  'periodStart',
  'updatedAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<AuditEngagementStatus>([
  'PLANNING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (ENGAGEMENT_CATALOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): AuditEngagementListSortField {
  return SORTABLE_FIELDS.includes(value as AuditEngagementListSortField)
    ? (value as AuditEngagementListSortField)
    : DEFAULT_SORT;
}

function parseStatus(value: string | null): AuditEngagementStatus | undefined {
  return value && VALID_STATUSES.has(value) ? (value as AuditEngagementStatus) : undefined;
}

function parseSingleValue(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

export type EngagementCatalogView = 'cards' | 'table';

export interface EngagementCatalogUrlState {
  page: number;
  pageSize: number;
  sort: AuditEngagementListSortField;
  direction: SortDirection;
  status: AuditEngagementStatus | undefined;
  orgUnitId: string | undefined;
  leadAuditorUserId: string | undefined;
  view: EngagementCatalogView;
}

export interface UseEngagementCatalogStateResult {
  state: EngagementCatalogUrlState;
  setStatus: (value: AuditEngagementStatus | undefined) => void;
  setOrgUnitId: (value: string | undefined) => void;
  setLeadAuditorUserId: (value: string | undefined) => void;
  setSort: (field: AuditEngagementListSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: EngagementCatalogView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function useEngagementCatalogState(): UseEngagementCatalogStateResult {
  const searchParams = useSearchParams();
  const commit = useUrlQueryCommit();

  const state: EngagementCatalogUrlState = {
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    status: parseStatus(searchParams.get('status')),
    orgUnitId: parseSingleValue(searchParams.get('orgUnitId')),
    leadAuditorUserId: parseSingleValue(searchParams.get('leadAuditorUserId')),
    view: searchParams.get('view') === 'table' ? 'table' : DEFAULT_VIEW,
  };

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
    (field: AuditEngagementListSortField, direction: SortDirection) => {
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
    (view: EngagementCatalogView) => {
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
    commit((params) => {
      for (const key of ['status', 'orgUnitId', 'leadAuditorUserId']) {
        params.delete(key);
      }
    });
  }, [commit]);

  const activeFilterCount =
    (state.status !== undefined ? 1 : 0) +
    (state.orgUnitId !== undefined ? 1 : 0) +
    (state.leadAuditorUserId !== undefined ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    activeFilterCount,
    setStatus: (value) => setSingleFilter('status', value),
    setOrgUnitId: (value) => setSingleFilter('orgUnitId', value),
    setLeadAuditorUserId: (value) => setSingleFilter('leadAuditorUserId', value),
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
