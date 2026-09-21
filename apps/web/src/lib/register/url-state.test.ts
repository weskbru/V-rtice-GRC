import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount-free evidence for `useUrlQueryCommit`/
 * `useDebouncedSearchParam` — the shared mechanism EVERY register-state hook
 * in this product builds on (this file's own header comment). Mirrors
 * `features/risks/hooks/use-register-state.test.ts`'s own mocking pattern:
 * `next/navigation` is mocked so `currentSearch` stands in for "the URL
 * right now", and `rerender()` after reassigning it simulates a real
 * navigation actually landing — never assumed to be synchronous with the
 * `router.replace` call that started it.
 *
 * ## The defect this file exists to pin (regression coverage, `action-plan.spec.ts:131`)
 *
 * `commit` used to read the "current" query string from a ref that was
 * refreshed ONLY inside an effect keyed on `useSearchParams()` — i.e. only
 * once a PREVIOUS `router.replace` had actually landed and this component
 * re-rendered with the new URL. Two commits fired back-to-back, with no
 * rerender in between (a real user interaction: switch a view toggle, then
 * immediately apply a filter), both read the SAME pre-first-commit
 * snapshot — the second `router.replace` silently overwrote the first
 * change instead of composing with it. Measured live: `action-plan.spec.ts`
 * switched a register to Tabela, applied two filters, and landed back on
 * Cards with the filters applied — the toggle silently reverted.
 *
 * The first test below reproduces exactly that shape and fails against the
 * pre-fix code (confirmed before writing the fix, not assumed).
 */
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

    // Both calls read the SAME render's `result.current` — no `rerender()`
    // between them, exactly the "no navigation has landed yet" gap a real
    // user's two quick clicks (view toggle, then a filter) leaves open.
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

    // An external navigation this hook did not itself perform (Back/Forward,
    // a pasted link) lands BEFORE the next commit — simulated by changing
    // the mocked URL and letting the component actually re-render with it,
    // the real signal `useSearchParams()` gives once a navigation lands.
    currentSearch = new URLSearchParams('status=DRAFT');
    rerender();

    act(() => {
      result.current((params) => params.set('originType', 'RISK_TREATMENT'));
    });

    const lastCall = replaceMock.mock.calls.at(-1)?.[0] as string;
    // The externally-restored param survives …
    expect(lastCall).toContain('status=DRAFT');
    expect(lastCall).toContain('originType=RISK_TREATMENT');
    // … and the earlier LOCAL commit, superseded by that external
    // navigation before this commit ran, is correctly gone — composing onto
    // a stale local write would be just as wrong as losing it silently.
    expect(lastCall).not.toContain('view=table');
  });
});

describe('useUrlQueryCommit + useDebouncedSearchParam', () => {
  /**
   * Mirrors `use-register-state.test.ts`'s own "filter applied during a
   * pending search debounce survives the debounce firing" — proved directly
   * against the shared hooks themselves, since every module's register hook
   * only re-exercises this same mechanism.
   */
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
      // Simulates Next.js having navigated to the URL the status commit
      // above just requested — the debounce timer armed by `setValue` is
      // still pending and must not later overwrite this.
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
