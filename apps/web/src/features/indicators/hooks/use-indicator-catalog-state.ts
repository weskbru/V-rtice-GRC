'use client';

/**
 * PharosGRC — indicator catalog URL state (009-indicators-reports, T062).
 *
 * Same mechanism as `features/incidents/hooks/use-incident-register-state
 * .ts` (that file's own header explains the shareable-link/Back-button/
 * no-drift reasoning this one does not repeat: every setter commits
 * directly to the URL via `router.replace`, every read comes straight from
 * `useSearchParams()` on the next render) — trimmed further than that
 * file, to the axes `indicators.openapi.yaml`'s own `listIndicatorDefinitions`
 * operation actually accepts: `page`, `pageSize`, `isActive`. No `search`,
 * no `sort` — the contract declares neither for this list (the catalog is
 * the closed, eleven-key `IndicatorMetricKey` registry; the register this
 * hook backs lists only the keys someone has actually configured, and
 * there is no free-text field or sortable column to expose yet). No
 * debounced search box either, for the same reason `use-incident-register
 * -state.ts` has one and this hook does not: there is nothing to debounce.
 */

// This hook writes the CURRENT screen's own query string (filters, sorting, pagination): not a
// navigation between screens, and routing it through `useNavigate` would raise the page-level
// loader over a filter change (specs/014-institutional-loader §2.3).
// eslint-disable-next-line no-restricted-imports -- see above.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

export const INDICATOR_CATALOG_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
/** Matches `indicators.openapi.yaml`'s own `PageSize` parameter default. */
const DEFAULT_PAGE_SIZE = 20;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (INDICATOR_CATALOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseIsActive(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export interface IndicatorCatalogUrlState {
  page: number;
  pageSize: number;
  isActive: boolean | undefined;
}

export interface UseIndicatorCatalogStateResult {
  state: IndicatorCatalogUrlState;
  setIsActive: (value: boolean | undefined) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useIndicatorCatalogState(): UseIndicatorCatalogStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state: IndicatorCatalogUrlState = {
    page: parsePositiveInt(searchParams.get('page'), 1),
    pageSize: parsePageSize(searchParams.get('pageSize')),
    isActive: parseIsActive(searchParams.get('isActive')),
  };

  const searchParamsString = searchParams.toString();
  const searchParamsStringRef = useRef(searchParamsString);
  useEffect(() => {
    searchParamsStringRef.current = searchParamsString;
  }, [searchParamsString]);

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void, resetPage = true) => {
      const next = new URLSearchParams(searchParamsStringRef.current);
      mutate(next);
      if (resetPage) {
        next.delete('page');
      }
      const queryString = next.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setIsActive = useCallback(
    (value: boolean | undefined) => {
      commit((params) => {
        if (value === undefined) {
          params.delete('isActive');
        } else {
          params.set('isActive', String(value));
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

  const clearFilters = useCallback(() => {
    commit((params) => {
      params.delete('isActive');
    });
  }, [commit]);

  const hasActiveFilters = state.isActive !== undefined;

  return {
    state,
    setIsActive,
    setPage,
    setPageSize,
    clearFilters,
    hasActiveFilters,
  };
}
