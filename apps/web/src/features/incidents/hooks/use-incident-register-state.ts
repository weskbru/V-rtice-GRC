'use client';

/**
 * PharosGRC — incident register URL state (008-incidents-problems, US1),
 * mirroring `features/assets/hooks/use-asset-catalog-state.ts` exactly
 * (CLAUDE.md §18.12 — a register joining the shared exploration frame
 * extends the established pattern, it does not keep its own copy of the
 * commit/debounce mechanism `@/lib/register/url-state` already owns).
 *
 * Trimmed/extended to the axes `incidents.openapi.yaml`'s own
 * `listIncidents` operation actually accepts (`search`, `status[]`,
 * `severity[]`, `orgUnitId`, `sort`, `direction`) plus the presentation-only
 * `view` (cards/table — CLAUDE.md §18, cards is the primary view). No
 * quick-view selection: this register has no side panel, matching
 * `IncidentCard`'s own doc comment.
 */

// Reads the current screen's own query string. The WRITE side — and the
// `useRouter` import the loader policy restricts — lives in the shared
// `@/lib/register/url-state` (specs/014-institutional-loader §2.3).
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { IncidentSeverity, IncidentStatus } from '../types';

export const REGISTER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
type IncidentSortField = 'code' | 'title' | 'severity' | 'status' | 'reportedOn' | 'updatedAt';
const DEFAULT_SORT: IncidentSortField = 'reportedOn';
const DEFAULT_DIRECTION: 'asc' | 'desc' = 'desc';
const DEFAULT_VIEW: IncidentRegisterView = 'cards';

const SORTABLE_FIELDS: readonly IncidentSortField[] = [
  'code',
  'title',
  'severity',
  'status',
  'reportedOn',
  'updatedAt',
];
const VALID_STATUSES: ReadonlySet<string> = new Set<IncidentStatus>([
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
]);
const VALID_SEVERITIES: ReadonlySet<string> = new Set<IncidentSeverity>([
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

function parseStatusList(value: string | null): readonly IncidentStatus[] {
  return parseCsv(value).filter((entry): entry is IncidentStatus => VALID_STATUSES.has(entry));
}

function parseSeverityList(value: string | null): readonly IncidentSeverity[] {
  return parseCsv(value).filter((entry): entry is IncidentSeverity => VALID_SEVERITIES.has(entry));
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

function parseSort(value: string | null): IncidentSortField {
  return SORTABLE_FIELDS.includes(value as IncidentSortField)
    ? (value as IncidentSortField)
    : DEFAULT_SORT;
}

function parseSingleValue(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

/** Which presentation the results area is currently rendering — cards is the primary view (CLAUDE.md §18), matching every other register in this codebase. */
export type IncidentRegisterView = 'cards' | 'table';

export interface IncidentRegisterUrlState {
  /** Committed (URL) search term — for display use `searchInputValue` instead. */
  search: string;
  page: number;
  pageSize: number;
  sort: IncidentSortField;
  direction: 'asc' | 'desc';
  status: readonly IncidentStatus[];
  severity: readonly IncidentSeverity[];
  orgUnitId: string | undefined;
  view: IncidentRegisterView;
}

export interface UseIncidentRegisterStateResult {
  state: IncidentRegisterUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setStatus: (values: readonly IncidentStatus[]) => void;
  setSeverity: (values: readonly IncidentSeverity[]) => void;
  setOrgUnitId: (value: string | undefined) => void;
  setSort: (field: IncidentSortField, direction: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: IncidentRegisterView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** How many filter fields are currently applied — shown on the collapsed "Filtros" button. */
  activeFilterCount: number;
}

export function useIncidentRegisterState(): UseIncidentRegisterStateResult {
  const searchParams = useSearchParams();
  // The commit mechanism — one change applied to the CURRENT query string,
  // `replace` not `push`, page reset by default — is shared with every other
  // register (`@/lib/register/url-state`). What stays here is what only this
  // register knows: its enums, sortable fields and defaults.
  const commit = useUrlQueryCommit();

  const urlSearch = searchParams.get('search') ?? '';

  const state: IncidentRegisterUrlState = {
    search: urlSearch,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'asc' ? 'asc' : DEFAULT_DIRECTION,
    status: parseStatusList(searchParams.get('status')),
    severity: parseSeverityList(searchParams.get('severity')),
    orgUnitId: parseSingleValue(searchParams.get('orgUnitId')),
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

  // Both directions (typing → URL after a pause, and URL → input on
  // Back/Forward, a pasted link or "clear filters") are the shared
  // mechanism's job, including cancelling a pending commit so it can never
  // overwrite a change that came from elsewhere mid-debounce.
  const {
    inputValue: searchInputValue,
    setValue: setSearch,
    clear: clearSearchInput,
  } = useDebouncedSearchParam(urlSearch, 'search', commit);

  const setOrgUnitId = useCallback(
    (value: string | undefined) => {
      commit((params) => {
        if (value) {
          params.set('orgUnitId', value);
        } else {
          params.delete('orgUnitId');
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

  const setSort = useCallback(
    (field: IncidentSortField, direction: 'asc' | 'desc') => {
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
    (view: IncidentRegisterView) => {
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
      for (const key of ['search', 'status', 'severity', 'orgUnitId']) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  /** Which filter FIELDS are narrowing the list right now — the number the collapsed "Filtros" button shows, from the same conditions the chip row is built on. */
  const activeFilterCount =
    (state.search !== '' ? 1 : 0) +
    (state.status.length > 0 ? 1 : 0) +
    (state.severity.length > 0 ? 1 : 0) +
    (state.orgUnitId !== undefined ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setStatus: (values) => setCsvFilter('status', values),
    setSeverity: (values) => setCsvFilter('severity', values),
    setOrgUnitId,
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
