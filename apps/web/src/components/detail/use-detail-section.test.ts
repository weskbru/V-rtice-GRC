import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => '/risks/abc-123',
  useSearchParams: () => currentSearch,
}));

import { useDetailSection } from './use-detail-section';

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

    expect(result.current.sectionParam).toBe('assessment');
  });

  it('writes `?section=` via the native History API, never through the router', () => {
    const { result } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });

    expect(replaceStateMock).toHaveBeenCalledTimes(1);
    const call = replaceStateMock.mock.calls[0]!;
    const [, , url] = call;
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

    currentSearch = new URLSearchParams('section=controls');
    rerender();

    expect(result.current.sectionParam).toBe('controls');
  });

  it('does not let a stale render clobber the section this hook itself just set', () => {
    const { result, rerender } = renderHook(() => useDetailSection());

    act(() => {
      result.current.setSection('assessment');
    });

    rerender();

    expect(result.current.sectionParam).toBe('assessment');
  });
});
