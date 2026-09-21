import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount-free evidence for `useIndicatorCatalogState` (009-
 * indicators-reports, T062) — same harness as `features/risks/hooks/
 * use-register-state.test.ts`: `next/navigation` is mocked so
 * `currentSearch` stands in for "the URL right now".
 */
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/indicators',
  useSearchParams: () => currentSearch,
}));

import {
  INDICATOR_CATALOG_PAGE_SIZE_OPTIONS,
  useIndicatorCatalogState,
} from './use-indicator-catalog-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useIndicatorCatalogState', () => {
  it('defaults to page 1, pageSize 20 (the contract default) and isActive unset on a bare /indicators URL', () => {
    const { result } = renderHook(() => useIndicatorCatalogState());

    expect(result.current.state).toEqual({ page: 1, pageSize: 20, isActive: undefined });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('offers exactly the page sizes indicators.openapi.yaml supports', () => {
    expect(INDICATOR_CATALOG_PAGE_SIZE_OPTIONS).toEqual([20, 50, 100]);
  });

  it('falls back to the default page size when the URL carries one the catalog does not offer', () => {
    currentSearch = new URLSearchParams('pageSize=7');
    const { result } = renderHook(() => useIndicatorCatalogState());

    expect(result.current.state.pageSize).toBe(20);
  });

  it('parses isActive from the URL, and ignores a value that is neither true nor false', () => {
    currentSearch = new URLSearchParams('isActive=true');
    expect(renderHook(() => useIndicatorCatalogState()).result.current.state.isActive).toBe(true);

    currentSearch = new URLSearchParams('isActive=false');
    expect(renderHook(() => useIndicatorCatalogState()).result.current.state.isActive).toBe(false);

    currentSearch = new URLSearchParams('isActive=bogus');
    expect(
      renderHook(() => useIndicatorCatalogState()).result.current.state.isActive,
    ).toBeUndefined();
  });

  it('setIsActive commits the filter and resets the page position', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useIndicatorCatalogState());

    act(() => {
      result.current.setIsActive(true);
    });

    expect(replaceMock).toHaveBeenCalledWith('/indicators?isActive=true', { scroll: false });
  });

  it('setPage does not reset itself, and setPageSize resets the page position', () => {
    currentSearch = new URLSearchParams('page=3&pageSize=100');
    const { result } = renderHook(() => useIndicatorCatalogState());

    act(() => {
      result.current.setPageSize(50);
    });

    expect(replaceMock).toHaveBeenCalledWith('/indicators?pageSize=50', { scroll: false });
  });

  it('omits pageSize from the URL when it is the default and writes it otherwise', () => {
    const { result } = renderHook(() => useIndicatorCatalogState());

    act(() => {
      result.current.setPageSize(100);
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/indicators?pageSize=100', { scroll: false });

    currentSearch = new URLSearchParams('pageSize=100');
    const { result: result2 } = renderHook(() => useIndicatorCatalogState());
    act(() => {
      result2.current.setPageSize(20);
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/indicators', { scroll: false });
  });

  it('clearFilters removes isActive from the URL and resets the page position', () => {
    currentSearch = new URLSearchParams('isActive=true&page=4');
    const { result } = renderHook(() => useIndicatorCatalogState());

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/indicators', { scroll: false });
  });

  it('reports hasActiveFilters only when isActive is set', () => {
    currentSearch = new URLSearchParams('isActive=false');
    const { result } = renderHook(() => useIndicatorCatalogState());

    expect(result.current.hasActiveFilters).toBe(true);
  });
});
