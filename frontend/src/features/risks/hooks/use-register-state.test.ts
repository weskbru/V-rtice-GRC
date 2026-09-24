import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/risks',
  useSearchParams: () => currentSearch,
}));

import { useRegisterState } from './use-register-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useRegisterState', () => {
  it('defaults to page 1, pageSize 50, sort code/asc and riskLevelBasis RESIDUAL on a bare /risks URL', () => {
    const { result } = renderHook(() => useRegisterState());

    expect(result.current.state).toMatchObject({
      page: 1,
      pageSize: 50,
      sort: 'code',
      direction: 'asc',
      riskLevelBasis: 'RESIDUAL',
      status: [],
      riskLevel: [],
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('drops values from a hand-edited or stale link that do not name a real RiskStatus/RiskLevel', () => {
    currentSearch = new URLSearchParams('status=DRAFT,BOGUS&riskLevel=HIGH,NONSENSE');
    const { result } = renderHook(() => useRegisterState());

    expect(result.current.state.status).toEqual(['DRAFT']);
    expect(result.current.state.riskLevel).toEqual(['HIGH']);
  });

  it('falls back to the default page size when the URL carries one the register does not offer', () => {
    currentSearch = new URLSearchParams('pageSize=7');
    const { result } = renderHook(() => useRegisterState());

    expect(result.current.state.pageSize).toBe(50);
  });

  it('setStatus commits the filter and resets the page position (FR-092)', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useRegisterState());

    act(() => {
      result.current.setStatus(['DRAFT', 'IDENTIFIED']);
    });

    expect(replaceMock).toHaveBeenCalledWith('/risks?status=DRAFT%2CIDENTIFIED', { scroll: false });
  });

  it('setPage does not reset itself, and setPageSize resets the page position', () => {
    currentSearch = new URLSearchParams('page=3&pageSize=100');
    const { result } = renderHook(() => useRegisterState());

    act(() => {
      result.current.setPageSize(25);
    });

    expect(replaceMock).toHaveBeenCalledWith('/risks?pageSize=25', { scroll: false });
  });

  it('omits riskLevelBasis from the URL when it is the server default (RESIDUAL) and writes it otherwise', () => {
    const { result } = renderHook(() => useRegisterState());

    act(() => {
      result.current.setRiskLevelBasis('INHERENT');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/risks?riskLevelBasis=INHERENT', {
      scroll: false,
    });

    currentSearch = new URLSearchParams('riskLevelBasis=INHERENT');
    const { result: result2 } = renderHook(() => useRegisterState());
    act(() => {
      result2.current.setRiskLevelBasis('RESIDUAL');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/risks', { scroll: false });
  });

  it("updates the search box's visible value immediately but debounces the URL commit", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useRegisterState());

      act(() => {
        result.current.setSearch('fornecedor');
      });
      expect(result.current.searchInputValue).toBe('fornecedor');
      expect(replaceMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(replaceMock).toHaveBeenCalledWith('/risks?q=fornecedor', { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a filter applied during a pending search debounce survives the debounce firing (state-loss race regression)', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => useRegisterState());

      act(() => {
        result.current.setSearch('fornecedor');
      });
      act(() => {
        result.current.setStatus(['DRAFT']);
      });
      currentSearch = new URLSearchParams('status=DRAFT');
      rerender();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain('status=DRAFT');
      expect(lastCall).toContain('q=fornecedor');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a sort change applied during a pending search debounce survives the debounce firing', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => useRegisterState());

      act(() => {
        result.current.setSearch('fornecedor');
      });
      act(() => {
        result.current.setSort('owner', 'desc');
      });
      currentSearch = new URLSearchParams('sort=owner&direction=desc');
      rerender();

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain('sort=owner');
      expect(lastCall).toContain('direction=desc');
      expect(lastCall).toContain('q=fornecedor');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a browser Back that changes other params but leaves q unchanged does not lose the pending search, and does not clobber the restored params', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => useRegisterState());

      act(() => {
        result.current.setSearch('fornecedor');
      });
      currentSearch = new URLSearchParams('status=DRAFT');
      rerender();

      expect(result.current.searchInputValue).toBe('fornecedor');

      act(() => {
        vi.advanceTimersByTime(500);
      });

      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain('status=DRAFT');
      expect(lastCall).toContain('q=fornecedor');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clearFilters removes every filter param (and the search box) at once', () => {
    currentSearch = new URLSearchParams('q=abc&status=DRAFT&page=4');
    const { result } = renderHook(() => useRegisterState());

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/risks', { scroll: false });
    expect(result.current.searchInputValue).toBe('');
  });

  it('leaves the risk-level basis out of the filter state entirely', () => {
    currentSearch = new URLSearchParams('riskLevelBasis=INHERENT');
    const { result } = renderHook(() => useRegisterState());

    expect(result.current.state.riskLevelBasis).toBe('INHERENT');
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('survives "clear filters" with the chosen basis intact', () => {
    currentSearch = new URLSearchParams('q=abc&riskLevelBasis=INHERENT');
    const { result } = renderHook(() => useRegisterState());

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/risks?riskLevelBasis=INHERENT', { scroll: false });
  });

  it('counts one active filter per applied FIELD, which is what the collapsed button shows', () => {
    currentSearch = new URLSearchParams(
      'q=abc&status=DRAFT,IDENTIFIED&riskLevel=HIGH&overdueReview=true',
    );
    const { result } = renderHook(() => useRegisterState());

    expect(result.current.activeFilterCount).toBe(4);
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
