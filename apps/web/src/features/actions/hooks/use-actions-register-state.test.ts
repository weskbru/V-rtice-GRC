import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/actions',
  useSearchParams: () => currentSearch,
}));

import { useActionsRegisterState } from './use-actions-register-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useActionsRegisterState', () => {
  it('defaults to page 1, pageSize 25, view cards and onlyMine true on a bare /actions URL', () => {
    const { result } = renderHook(() => useActionsRegisterState());

    expect(result.current.state).toMatchObject({
      page: 1,
      pageSize: 25,
      view: 'cards',
      onlyMine: true,
      status: undefined,
      originType: undefined,
      overdue: false,
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('reads onlyMine=false from the URL as the caller having turned the default off', () => {
    currentSearch = new URLSearchParams('onlyMine=false');
    const { result } = renderHook(() => useActionsRegisterState());

    expect(result.current.state.onlyMine).toBe(false);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('setOnlyMine(false) writes onlyMine=false; setOnlyMine(true) deletes the param instead of writing it', () => {
    const { result } = renderHook(() => useActionsRegisterState());

    act(() => {
      result.current.setOnlyMine(false);
    });
    expect(replaceMock).toHaveBeenCalledWith('/actions?onlyMine=false', { scroll: false });

    currentSearch = new URLSearchParams('onlyMine=false');
    const { result: reopened } = renderHook(() => useActionsRegisterState());
    act(() => {
      reopened.current.setOnlyMine(true);
    });
    expect(replaceMock).toHaveBeenCalledWith('/actions', { scroll: false });
  });

  it('drops a status/originType value from a hand-edited or stale link that does not name a real enum member', () => {
    currentSearch = new URLSearchParams('status=BOGUS&originType=NONSENSE');
    const { result } = renderHook(() => useActionsRegisterState());

    expect(result.current.state.status).toBeUndefined();
    expect(result.current.state.originType).toBeUndefined();
  });

  it('setStatus commits the filter and resets the page position', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useActionsRegisterState());

    act(() => {
      result.current.setStatus('OPEN');
    });

    expect(replaceMock).toHaveBeenCalledWith('/actions?status=OPEN', { scroll: false });
  });

  it('clearFilters resets status, originType, overdue and onlyMine back to their defaults', () => {
    currentSearch = new URLSearchParams(
      'status=OPEN&originType=INCIDENT&overdue=true&onlyMine=false',
    );
    const { result } = renderHook(() => useActionsRegisterState());
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/actions', { scroll: false });
  });

  it('setView(table) does not reset the page position', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useActionsRegisterState());

    act(() => {
      result.current.setView('table');
    });

    expect(replaceMock).toHaveBeenCalledWith('/actions?page=3&view=table', { scroll: false });
  });
});
