import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/actions',
  useSearchParams: () => currentSearch,
}));

import { SEARCH_DEBOUNCE_MS, useDebouncedSearchParam, useUrlQueryCommit } from './url-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useUrlQueryCommit', () => {
  it('composes two commits fired back-to-back, before the first has landed as a real navigation', () => {
    const { result } = renderHook(() => useUrlQueryCommit());

    act(() => {
      result.current((params) => params.set('view', 'table'), false);
    });
    act(() => {
      result.current((params) => params.set('originType', 'RISK_TREATMENT'));
    });

    const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('view=table');
    expect(lastCall).toContain('originType=RISK_TREATMENT');
  });

  it('builds the next commit on an external URL change, not on an earlier locally-committed one', () => {
    const { result, rerender } = renderHook(() => useUrlQueryCommit());

    act(() => {
      result.current((params) => params.set('view', 'table'), false);
    });

    currentSearch = new URLSearchParams('status=DRAFT');
    rerender();

    act(() => {
      result.current((params) => params.set('originType', 'RISK_TREATMENT'));
    });

    const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).toContain('status=DRAFT');
    expect(lastCall).toContain('originType=RISK_TREATMENT');
    expect(lastCall).not.toContain('view=table');
  });
});

describe('useUrlQueryCommit + useDebouncedSearchParam', () => {
  it('a status change committed while a debounced search is pending survives the debounce firing', () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => {
        const commit = useUrlQueryCommit();
        const search = useDebouncedSearchParam('', 'q', commit);
        return { commit, search };
      });

      act(() => {
        result.current.search.setValue('fornecedor');
      });
      expect(replaceMock).not.toHaveBeenCalled();

      act(() => {
        result.current.commit((params) => params.set('status', 'DRAFT'));
      });
      currentSearch = new URLSearchParams('status=DRAFT');
      rerender();

      act(() => {
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 50);
      });

      const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
      expect(lastCall).toContain('status=DRAFT');
      expect(lastCall).toContain('q=fornecedor');
    } finally {
      vi.useRealTimers();
    }
  });
});
