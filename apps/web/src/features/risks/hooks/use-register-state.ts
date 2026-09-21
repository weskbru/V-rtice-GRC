'use client';

/**
 * PharosGRC — risk register URL state (T112, FR-092, US3 AS7).
 *
 * The URL query string IS the register's state — there is no separate
 * `useState` copy of "current filters" that could drift from it. Every
 * setter here reads the *current* `useSearchParams()` snapshot, applies one
 * change, and calls `router.replace()` with the resulting query string.
 * Three consequences fall out of that single design choice:
 *
 *   1. **Shareable link**: at any moment the address bar already IS the
 *      exact state a copy-pasted link would reproduce — nothing is held
 *      only in memory.
 *   2. **Back button**: `router.replace()` (never `push()`) updates the
 *      *current* history entry instead of stacking one entry per filter
 *      click, so the register's own history entry always reflects the last
 *      applied state. Navigating to a risk's detail page is a `push()` (an
 *      ordinary `<Link>`/`router.push`), so the browser's Back button from
 *      there lands the user back on exactly that one register URL — this is
 *      what FR-092 actually asks for ("preserve applied filters... when the
 *      user navigates to a risk and returns"), not a page reload.
 *   3. **No history spam from typing**: because search commits are
 *      debounced (see `setSearch` below) and also go through `replace()`,
 *      typing a 10-character search term produces at most one settled URL
 *      state, not ten history entries or ten navigations.
 *
 * Defaults are never written to the URL (an unset `sort` means the
 * contract's own default of `code`/`asc`, an unset `riskLevelBasis` means
 * `RESIDUAL`, ...) — this keeps a freshly-opened `/risks` URL clean and
 * means "reset to default" and "remove the parameter" are the same
 * operation, not two things that could disagree.
 *
 * Any filter value read from the URL that doesn't name a real `RiskStatus`/
 * `RiskLevel` is silently dropped (`parseStatusList`/`parseLevelList`)
 * rather than sent to the server — a hand-edited or stale shared link must
 * degrade to "no filter on that field", never to a `400` the user cannot
 * explain.
 */

// Reads the current screen's own query string. The WRITE side — and the
// `useRouter` import the loader policy restricts — now lives in the shared
// `@/lib/register/url-state`, with the same justification recorded there
// (specs/014-institutional-loader §2.3).
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

/** Which presentation the results area is currently rendering. Cards is the primary view; the table stays for dense comparison (CLAUDE.md §18). */
export type RiskRegisterView = 'cards' | 'table';

export interface RiskRegisterUrlState {
  /** Committed (URL) search term — for display use `searchInputValue` instead, which updates immediately on every keystroke. */
  q: string;
  /** 1-based page number. */
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
  /**
   * Not a filter. Lives in the URL for the same three reasons everything
   * else here does (shareable link, Back button, no in-memory copy that
   * could drift) — and, critically, because it means switching Cards ↔
   * Tabela is a change to ONE parameter of the same query string: filters,
   * search, sort and page position are not re-derived, re-applied or reset,
   * they are simply not touched. `hasActiveFilters` deliberately ignores
   * it: choosing a presentation has never narrowed a result set, and
   * "Limpar filtros" must not silently throw the user back to the other
   * view.
   */
  view: RiskRegisterView;
}

export interface UseRegisterStateResult {
  state: RiskRegisterUrlState;
  /** The search input's live value — always up to date, even before the debounced URL commit fires. Bind this to the search box, never `state.q` directly. */
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
  /** 1-based. */
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setView: (view: RiskRegisterView) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** How many filter fields are currently applied — shown on the collapsed "Filtros" button. */
  activeFilterCount: number;
}

/**
 * Reads/writes the risk register's filters, search term, sort and page
 * position through the URL query string (T112, FR-092). See the module doc
 * comment above for how this satisfies "preserve state across a visit to a
 * risk's detail page", the browser Back button, and a shared link, all from
 * the same single mechanism.
 */
export function useRegisterState(): UseRegisterStateResult {
  const searchParams = useSearchParams();
  // The commit mechanism itself — one change applied to the CURRENT query
  // string, `replace` not `push`, page reset by default — is shared with
  // every other register (`@/lib/register/url-state`). What stays here is
  // only what this register knows and no generic hook should: which statuses
  // and levels exist, which fields `GET /risks` accepts for `sort`, and what
  // each parameter defaults to.
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

  // ---- Search: immediate visual feedback, debounced URL commit ----------
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

  /**
   * `resetPage: false` is the whole requirement, not an optimisation:
   * changing how results are drawn is not changing which results they are,
   * so page position (and every filter, the search term and the sort) must
   * survive the switch untouched. `commit`'s default would have silently
   * sent the user back to page 1 on every toggle.
   */
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

  /**
   * `riskLevelBasis` is deliberately NOT cleared here, and deliberately not
   * counted below either: choosing between the residual and the inherent
   * level changes how each risk's level is LABELLED and rendered, never
   * which risks come back. Treating it as a filter made "Limpar filtros"
   * silently switch the column the user was reading, and let an empty
   * result set be explained as "no risk matches these filters" when the
   * basis had nothing to do with it. It now lives with the ordering and the
   * Cards/Tabela toggle, where the other display decisions are.
   */
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

  /** Which filter FIELDS are narrowing the list right now — the number the collapsed "Filtros" button shows, and the same conditions the chip row is built from, so the two can never disagree. */
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
