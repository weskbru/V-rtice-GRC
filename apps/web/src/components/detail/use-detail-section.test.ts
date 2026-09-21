import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PharosGRC — regression coverage for `useDetailSection`'s
 * 023-detail-nav-performance fix (this hook's own header comment has the
 * full measurement and mechanism).
 *
 * Mirrors `@/lib/register/url-state.test.ts`'s own mocking pattern:
 * `next/navigation` is mocked so `currentSearch` stands in for "the URL
 * right now". The one addition this file needs beyond that pattern is
 * swapping `window.history.replaceState` for a `vi.fn()`, since the whole
 * point of the fix is that `setSection` no longer goes through
 * `next/navigation`'s router at all — there is deliberately no `useRouter`
 * mock here, matching that the hook no longer imports it.
 */
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/risks/abc-123',
  useSearchParams: () => currentSearch,
}));

import { useDetailSection } from './use-detail-section';

// A plain swapped `vi.fn()`, not `vi.spyOn` — `history.replaceState`'s own
// overloaded DOM lib types make `vi.spyOn`'s return type collapse to `any`
// under this workspace's typed ESLint rules. Restored in `afterEach` so no
// other test file inherits the mock.
const originalReplaceState = window.history.replaceState.bind(window.history);
let replaceStateMock: ReturnType<typeof vi.fn<typeof window.history.replaceState>>;

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceStateMock = vi.fn<typeof window.history.replaceState>();
  window.history.replaceState = replaceStateMock;
});

afterEach(() => {
  window.history.replaceState = originalReplaceState;
});

describe('useDetailSection', () => {
  it('reads the initial section from the URL (deep link / refresh)', () => {
    currentSearch = new URLSearchParams('section=controls');
    const { result } = renderHook(() => useDetailSection());

    expect(result.current.sectionParam).toBe('controls');
  });

  it('is `null` when `?section=` is absent, leaving fallback resolution to the caller', () => {
    const { result } = renderHook(() => useDetailSection());

    expect(result.current.sectionParam).toBeNull();
  });

  it('updates the render source synchronously on setSection, with no rerender needed', () => {
    const { result } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });

    // No `rerender()` call in between — this is the exact property the fix
    // exists to guarantee: the tab switches on the SAME click, not once a
    // navigation the old `router.replace()` path required has landed.
    expect(result.current.sectionParam).toBe('assessment');
  });

  it('writes `?section=` via the native History API, never through the router', () => {
    const { result } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });

    expect(replaceStateMock).toHaveBeenCalledTimes(1);
    // `null` as the state argument, matching Next.js's own documented
    // pattern (this hook's header comment) — a non-`__NA` state is what
    // makes Next's patched `replaceState` treat this as an external call
    // and restore `canonicalUrl` from the URL instead of a no-op.
    const call = replaceStateMock.mock.calls[0]!;
    const [, , url] = call;
    // `history.replaceState`'s DOM lib type declares its first parameter as
    // `any` — routed through `unknown` so this assertion does not need an
    // unsafe-assignment suppression for it.
    const state: unknown = call[0];
    expect(state).toBeNull();
    expect(String(url)).toBe('/risks/abc-123?section=assessment');
  });

  it('preserves other existing query parameters when writing the new section', () => {
    currentSearch = new URLSearchParams('foo=bar');
    const { result } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('controls');
    });

    const [, , url] = replaceStateMock.mock.calls[0]!;
    expect(String(url)).toContain('foo=bar');
    expect(String(url)).toContain('section=controls');
  });

  it('reconciles from an external URL change (Back/Forward, a pasted link)', () => {
    const { result, rerender } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });
    expect(result.current.sectionParam).toBe('assessment');

    // An external navigation this hook did not itself perform lands —
    // simulated exactly like `url-state.test.ts` does, by changing the
    // mocked URL and re-rendering.
    currentSearch = new URLSearchParams('section=controls');
    rerender();

    expect(result.current.sectionParam).toBe('controls');
  });

  it('does not let a stale render clobber the section this hook itself just set', () => {
    const { result, rerender } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });

    // A rerender with the SAME (not-yet-landed) URL must not undo the local
    // write — `currentSearch` here still models the pre-`setSection` URL,
    // since the mock does not simulate Next actually applying the write.
    rerender();

    expect(result.current.sectionParam).toBe('assessment');
  });
});
