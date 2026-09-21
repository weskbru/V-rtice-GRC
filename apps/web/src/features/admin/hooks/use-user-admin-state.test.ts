import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount-free evidence for `useUserAdminState`, mirroring
 * `use-actions-register-state.test.ts`'s own approach: `next/navigation` is
 * mocked so `currentSearch` stands in for "the URL right now".
 *
 * This hook replaced the screen's former local `useState` filters — these
 * tests pin down that the URL genuinely is the state: a filter change is a
 * committed query string, not memory that a reload would lose, and the
 * chips a caller sees are exactly the fields `activeFilterCount` counts.
 */
const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/admin/users',
  useSearchParams: () => currentSearch,
}));

import { useUserAdminState } from './use-user-admin-state';

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
});

describe('useUserAdminState', () => {
  it('defaults to page 1, pageSize 25, sort fullName:asc and view table on a bare URL', () => {
    const { result } = renderHook(() => useUserAdminState());

    expect(result.current.state).toMatchObject({
      page: 1,
      pageSize: 25,
      sort: 'fullName',
      direction: 'asc',
      view: 'table',
      status: undefined,
      orgUnitId: undefined,
      roleId: undefined,
      q: '',
    });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('drops a status value from a hand-edited or stale link that does not name a real status', () => {
    currentSearch = new URLSearchParams('status=BOGUS');
    const { result } = renderHook(() => useUserAdminState());

    expect(result.current.state.status).toBeUndefined();
  });

  it('setStatus commits the filter to the URL and counts it as one active filter', () => {
    const { result } = renderHook(() => useUserAdminState());

    act(() => {
      result.current.setStatus('ACTIVE');
    });

    expect(replaceMock).toHaveBeenCalledWith('/admin/users?status=ACTIVE', { scroll: false });

    currentSearch = new URLSearchParams('status=ACTIVE');
    const { result: reopened } = renderHook(() => useUserAdminState());
    expect(reopened.current.hasActiveFilters).toBe(true);
    expect(reopened.current.activeFilterCount).toBe(1);
  });

  it('setOrgUnitId and setRoleId each commit their own single value', () => {
    const { result } = renderHook(() => useUserAdminState());

    act(() => {
      result.current.setOrgUnitId('unit-1');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/admin/users?orgUnitId=unit-1', {
      scroll: false,
    });

    currentSearch = new URLSearchParams('orgUnitId=unit-1');
    const { result: withOrgUnit } = renderHook(() => useUserAdminState());
    act(() => {
      withOrgUnit.current.setRoleId('role-1');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/admin/users?orgUnitId=unit-1&roleId=role-1', {
      scroll: false,
    });
  });

  it('three simultaneous filters count as three, and clearFilters removes all of them at once', () => {
    currentSearch = new URLSearchParams('status=ACTIVE&orgUnitId=unit-1&roleId=role-1&q=ana');
    const { result } = renderHook(() => useUserAdminState());

    expect(result.current.activeFilterCount).toBe(4);

    act(() => {
      result.current.clearFilters();
    });

    expect(replaceMock).toHaveBeenCalledWith('/admin/users', { scroll: false });
  });

  it('setSort writes a non-default field/direction pair and omits the default pair entirely', () => {
    const { result } = renderHook(() => useUserAdminState());

    act(() => {
      result.current.setSort('lastLoginAt', 'desc');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/admin/users?sort=lastLoginAt&direction=desc', {
      scroll: false,
    });

    currentSearch = new URLSearchParams('sort=lastLoginAt&direction=desc');
    const { result: reopened } = renderHook(() => useUserAdminState());
    act(() => {
      reopened.current.setSort('fullName', 'asc');
    });
    expect(replaceMock).toHaveBeenLastCalledWith('/admin/users', { scroll: false });
  });

  it('setView(cards) does not reset the page position, and table (the default) is omitted from the URL', () => {
    currentSearch = new URLSearchParams('page=3');
    const { result } = renderHook(() => useUserAdminState());

    act(() => {
      result.current.setView('cards');
    });
    expect(replaceMock).toHaveBeenCalledWith('/admin/users?page=3&view=cards', { scroll: false });

    currentSearch = new URLSearchParams('page=3&view=cards');
    const { result: reopened } = renderHook(() => useUserAdminState());
    act(() => {
      reopened.current.setView('table');
    });
    expect(replaceMock).toHaveBeenCalledWith('/admin/users?page=3', { scroll: false });
  });
});
