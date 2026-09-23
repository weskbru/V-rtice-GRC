import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/reports',
  useSearchParams: () => currentSearch,
}));

import {
  REPORT_CATALOG_PAGE_SIZE_OPTIONS,
  useReportCatalogState,
} from './use-report-catalog-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useReportCatalogState', () => {
  it('defaults to page 1, pageSize 20 (the contract default) and isActive unset on a bare /reports URL', () => {
    const { result } = renderHook(() => useReportCatalogState());

    expect(result.current.state).toEqual({ page: 1, pageSize: 20, isActive: undefined });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('offers exactly the page sizes reports.openapi.yaml supports', () => {
    expect(REPORT_CATALOG_PAGE_SIZE_OPTIONS).toEqual([20, 50, 100]);
  });

  it('parses isActive from the URL, and ignores a value that is neither true nor false', () => {
    currentSearch = new URLSearchParams('isActive=true');
    expect(renderHook(() => useReportCatalogState()).result.current.state.isActive).toBe(true);

    currentSearch = new URLSearchParams('isActive=false');
    expect(renderHook(() => useReportCatalogState()).result.current.state.isActive).toBe(false);

    currentSearch = new URLSearchParams('isActive=bogus');
    expect(renderHook(() => useReportCatalogState()).result.current.state.isActive).toBeUndefined();
  });

  it('setIsActive commits the filter and resets the page position', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useReportCatalogState());

    act(() => {
      result.current.setIsActive(true);
    });

    expect(replaceMock).toHaveBeenCalledWith('/reports?isActive=true', { scroll: false });
  });

  it('clearFilters removes isActive from the URL and resets the page position', () => {
    currentSearch = new URLSearchParams('isActive=true&page=4');
    const { result } = renderHook(() => useReportCatalogState());

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/reports', { scroll: false });
  });

  it('reports hasActiveFilters only when isActive is set', () => {
    currentSearch = new URLSearchParams('isActive=false');
    const { result } = renderHook(() => useReportCatalogState());

    expect(result.current.hasActiveFilters).toBe(true);
  });
});
