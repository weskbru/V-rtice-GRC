import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mirrors `use-actions-register-state.test.ts`'s own approach: `next/
 * navigation` is mocked so `currentSearch` stands in for "the URL right
 * now". `q` goes through `useDebouncedSearchParam`, so its own commit is
 * exercised via fake timers rather than asserted synchronously.
 */
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/indicators',
  useSearchParams: () => currentSearch,
}));

import { useIndicatorOverviewState } from './use-indicator-overview-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useIndicatorOverviewState', () => {
  it('defaults to an empty query and domain ALL on a bare /indicators URL', () => {
    const { result } = renderHook(() => useIndicatorOverviewState());

    expect(result.current.query).toBe('');
    expect(result.current.domain).toBe('ALL');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('reads a valid domain from the URL', () => {
    currentSearch = new URLSearchParams('domain=RISK');
    const { result } = renderHook(() => useIndicatorOverviewState());

    expect(result.current.domain).toBe('RISK');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('treats a domain outside the closed ten-value set as ALL, never throwing', () => {
    currentSearch = new URLSearchParams('domain=BOGUS');
    const { result } = renderHook(() => useIndicatorOverviewState());

    expect(result.current.domain).toBe('ALL');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('reads q from the URL as the initial search box value', () => {
    currentSearch = new URLSearchParams('q=risco');
    const { result } = renderHook(() => useIndicatorOverviewState());

    expect(result.current.query).toBe('risco');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('setDomain(value) writes ?domain=value; setDomain(ALL) deletes the param instead', () => {
    const { result } = renderHook(() => useIndicatorOverviewState());

    act(() => {
      result.current.setDomain('CONTROL');
    });
    expect(replaceMock).toHaveBeenCalledWith('/indicators?domain=CONTROL', { scroll: false });

    currentSearch = new URLSearchParams('domain=CONTROL');
    const { result: reopened } = renderHook(() => useIndicatorOverviewState());
    act(() => {
      reopened.current.setDomain('ALL');
    });
    expect(replaceMock).toHaveBeenCalledWith('/indicators', { scroll: false });
  });

  it('setQuery updates the input value immediately, ahead of any debounced commit', () => {
    const { result } = renderHook(() => useIndicatorOverviewState());

    act(() => {
      result.current.setQuery('conformidade');
    });
    expect(result.current.query).toBe('conformidade');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('clearFilters resets both q and domain, and clears the live search box value', () => {
    currentSearch = new URLSearchParams('q=risco&domain=RISK');
    const { result } = renderHook(() => useIndicatorOverviewState());
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.query).toBe('');
    expect(replaceMock).toHaveBeenCalledWith('/indicators', { scroll: false });
  });
});
