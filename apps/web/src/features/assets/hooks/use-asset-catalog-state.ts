'use client';

/**
 * PharosGRC — asset catalog URL state (T046), mirroring
 * `features/audit-engagements/hooks/use-engagement-catalog-state.ts` for
 * the single-value org unit/situation filters (`GET /assets` accepts
 * exactly one value per filter field — no CSV multi-select, unlike
 * `features/controls/hooks/use-catalog-state.ts`'s own richer filter set),
 * combined with that same file's debounced free-text search — `GET
 * /assets` DOES accept `q`, unlike `GET /audits`.
 *
 * AGENTS.md "Frontend state": this hook owns no `useState` mirror plus a
 * write-back effect for anything the URL itself already represents — every
 * setter commits directly to the URL via `router.replace`, and every read
 * comes straight from `useSearchParams()` on the next render. The one
 * `useState` here (`searchInputValue`) is NOT such a mirror: it holds the
 * in-progress keystroke value between commits, exists so typing doesn't
 * feel throttled by the debounce, and is reconciled FROM the URL by a
 * read-only effect (e.g. browser back/forward) — never written back to the
 * URL by an effect of its own; only `setSearch`'s own debounced timer ever
 * calls `commit`.
 */

// Reads the current screen's own query string. The WRITE side — and the
// `useRouter` import the loader policy restricts — lives in the shared
// `@/lib/register/url-state` (specs/014-institutional-loader §2.3).
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import { useDebouncedSearchParam, useUrlQueryCommit } from '@/lib/register/url-state';

import type { AssetListSortField, SortDirection } from '../types';

export const ASSET_CATALOG_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_SORT: AssetListSortField = 'code';
const DEFAULT_DIRECTION: SortDirection = 'asc';
const DEFAULT_VIEW: AssetCatalogView = 'cards';

const SORTABLE_FIELDS: readonly AssetListSortField[] = ['code', 'name', 'updatedAt'];

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (ASSET_CATALOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseSort(value: string | null): AssetListSortField {
  return SORTABLE_FIELDS.includes(value as AssetListSortField)
    ? (value as AssetListSortField)
    : DEFAULT_SORT;
}

function parseIsActive(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseSingleValue(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

/** Which presentation the results area is currently rendering — cards is the primary view (CLAUDE.md §18). */
export type AssetCatalogView = 'cards' | 'table';

export interface AssetCatalogUrlState {
  q: string;
  page: number;
  pageSize: number;
  sort: AssetListSortField;
  direction: SortDirection;
  orgUnitId: string | undefined;
  isActive: boolean | undefined;
  view: AssetCatalogView;
}

export interface UseAssetCatalogStateResult {
  state: AssetCatalogUrlState;
  searchInputValue: string;
  setSearch: (value: string) => void;
  setOrgUnitId: (value: string | undefined) => void;
  setIsActive: (value: boolean | undefined) => void;
  setSort: (field: AssetListSortField, direction: SortDirection) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: AssetCatalogView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** How many filter fields are currently applied — shown on the collapsed "Filtros" button. */
  activeFilterCount: number;
}

export function useAssetCatalogState(): UseAssetCatalogStateResult {
  const searchParams = useSearchParams();
  // The commit mechanism — one change applied to the CURRENT query string,
  // `replace` not `push`, page reset by default — is shared with every
  // other register (`@/lib/register/url-state`). What stays here is what
  // only this catalog knows: its enums, sortable fields and defaults.
  const commit = useUrlQueryCommit();

  const urlQ = searchParams.get('q') ?? '';

  const state: AssetCatalogUrlState = {
    q: urlQ,
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    sort: parseSort(searchParams.get('sort')),
    direction: searchParams.get('direction') === 'desc' ? 'desc' : DEFAULT_DIRECTION,
    orgUnitId: parseSingleValue(searchParams.get('orgUnitId')),
    isActive: parseIsActive(searchParams.get('isActive')),
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

  // Both directions (typing → URL after a pause, and URL → input on
  // Back/Forward, a pasted link or "clear filters") are the shared
  // mechanism's job, including cancelling a pending commit so it can never
  // overwrite a change that came from elsewhere mid-debounce.
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
    (field: AssetListSortField, direction: SortDirection) => {
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
    (view: AssetCatalogView) => {
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
      for (const key of ['q', 'orgUnitId', 'isActive']) {
        params.delete(key);
      }
    });
  }, [commit, clearSearchInput]);

  /** Which filter FIELDS are narrowing the list right now — the number the collapsed "Filtros" button shows, from the same conditions the chip row is built on. */
  const activeFilterCount =
    (state.q !== '' ? 1 : 0) +
    (state.orgUnitId !== undefined ? 1 : 0) +
    (state.isActive !== undefined ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  return {
    state,
    searchInputValue,
    activeFilterCount,
    setSearch,
    setOrgUnitId: (value) => setSingleFilter('orgUnitId', value),
    setIsActive: (value) => {
      commit((params) => {
        if (value === undefined) {
          params.delete('isActive');
        } else {
          params.set('isActive', String(value));
        }
      });
    },
    setSort,
    setPage,
    setPageSize,
    setView,
    clearFilters,
    hasActiveFilters,
  };
}
