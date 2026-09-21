import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount-free evidence for `useProblemRegisterState`, mirroring
 * `use-register-state.test.ts`'s own approach: `next/navigation` is mocked
 * so `currentSearch` stands in for "the URL right now".
 *
 * This hook was migrated onto the SHARED `useUrlQueryCommit`/
 * `useDebouncedSearchParam` mechanism (`@/lib/register/url-state`) in place
 * of its own former hand-rolled copy — these tests pin down that the
 * observable contract (defaults, filter commits, page reset, the `view`
 * axis) survived that migration unchanged.
 */
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/problems',
  useSearchParams: () => currentSearch,
}));

import { useProblemRegisterState } from './use-problem-register-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useProblemRegisterState', () => {
  it('defaults to page 1, pageSize 25, sort identifiedOn/desc and view cards on a bare /problems URL', () => {
    const { result } = renderHook(() => useProblemRegisterState());

    expect(result.current.state).toMatchObject({
      page: 1,
      pageSize: 25,
      sort: 'identifiedOn',
      direction: 'desc',
      view: 'cards',
      status: [],
      severity: [],
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('drops values from a hand-edited or stale link that do not name a real ProblemStatus/ProblemSeverity', () => {
    currentSearch = new URLSearchParams('status=OPEN,BOGUS&severity=HIGH,NONSENSE');
    const { result } = renderHook(() => useProblemRegisterState());

    expect(result.current.state.status).toEqual(['OPEN']);
    expect(result.current.state.severity).toEqual(['HIGH']);
  });

  it('setStatus commits the filter and resets the page position', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useProblemRegisterState());

    act(() => {
      result.current.setStatus(['OPEN', 'IN_ANALYSIS']);
    });

    expect(replaceMock).toHaveBeenCalledWith('/problems?status=OPEN%2CIN_ANALYSIS', {
      scroll: false,
    });
  });

  it('setView(table) does not reset the page position, and stays out of activeFilterCount', () => {
    currentSearch = new URLSearchParams('page=3&status=OPEN');
    const { result } = renderHook(() => useProblemRegisterState());
    const countBefore = result.current.activeFilterCount;

    act(() => {
      result.current.setView('table');
    });

    expect(replaceMock).toHaveBeenCalledWith('/problems?page=3&status=OPEN&view=table', {
      scroll: false,
    });
    expect(result.current.activeFilterCount).toBe(countBefore);
  });

  it('clearFilters removes search, status and severity but leaves view untouched', () => {
    currentSearch = new URLSearchParams('search=falha&status=OPEN&severity=HIGH&view=table');
    const { result } = renderHook(() => useProblemRegisterState());
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/problems?view=table', { scroll: false });
  });
});
