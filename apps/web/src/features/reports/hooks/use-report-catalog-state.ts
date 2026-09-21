'use client';

/**
 * PharosGRC — report catalog URL state (009-indicators-reports, T062).
 *
 * Same mechanism, and trimmed to the same axes, as `features/indicators/hooks/
 * use-indicator-catalog-state.ts` (that file's own header explains the shareable-link/Back-button/
 * no-drift reasoning this one does not repeat: every setter commits directly to the URL via
 * `router.replace`, every read comes straight from `useSearchParams()` on the next render) —
 * `page`, `pageSize`, `isActive` are the only parameters `listReportDefinitions` actually declares
 * (`contracts/reports.openapi.yaml`). No `search`, no `sort`.
 */

// This hook writes the CURRENT screen's own query string (filters, sorting, pagination): not a
// navigation between screens, and routing it through `useNavigate` would raise the page-level
// loader over a filter change (specs/014-institutional-loader §2.3).
// eslint-disable-next-line no-restricted-imports -- see above.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

export const REPORT_CATALOG_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
/** Matches `reports.openapi.yaml`'s own `PageSize` parameter default. */
const DEFAULT_PAGE_SIZE = 20;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | null): number {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return (REPORT_CATALOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? parsed
    : DEFAULT_PAGE_SIZE;
}

function parseIsActive(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export interface ReportCatalogUrlState {
  page: number;
  pageSize: number;
  isActive: boolean | undefined;
}

export interface UseReportCatalogStateResult {
  state: ReportCatalogUrlState;
  setIsActive: (value: boolean | undefined) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  /** Shown as a badge on the collapsed "Filtros" button (CLAUDE.md §18.12 family convergence). */
  activeFilterCount: number;
}

export function useReportCatalogState(): UseReportCatalogStateResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state: ReportCatalogUrlState = {
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
  // Only one filter field exists on this contract (`isActive`) — the count is therefore 0 or 1,
  // never more, but it is still computed rather than hardcoded so a future filter field cannot
  // silently drift from what the chip row actually shows.
  const activeFilterCount = state.isActive !== undefined ? 1 : 0;

  return {
    state,
    setIsActive,
    setPage,
    setPageSize,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
  };
}
