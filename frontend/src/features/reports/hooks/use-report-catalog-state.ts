'use client';

// eslint-disable-next-line no-restricted-imports -- este hook centraliza o acesso à URL.
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

export const REPORT_CATALOG_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
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
