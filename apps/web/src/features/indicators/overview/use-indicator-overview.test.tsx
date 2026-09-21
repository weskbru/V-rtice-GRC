import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount evidence for `useIndicatorOverview` (indicators-round, S2
 * ownership) — network boundary mocked (`dashboardApi.getSummary`,
 * `indicatorsApi.listDefinitions`), everything between them and the returned
 * result is real, same convention as `(app)/dashboard/page.test.tsx`.
 *
 * `usePermissions()` is mocked directly (not via a real `AuthProvider`) so
 * the "permission changes re-derive links without a refetch" test below can
 * change `hasPermission`'s behavior between renders on demand — swapping
 * `AuthProvider`'s `initialSession` prop would NOT do this: that prop only
 * seeds the provider's internal `useState` once, at first mount, and is
 * ignored on every subsequent prop change (`lib/auth-context.tsx`).
 */
const { getSummaryMock, listDefinitionsMock, usePermissionsMock } = vi.hoisted(() => ({
  getSummaryMock: vi.fn(),
  listDefinitionsMock: vi.fn(),
  usePermissionsMock: vi.fn(),
}));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getSummary: getSummaryMock },
}));

vi.mock('../api', () => ({
  indicatorsApi: { listDefinitions: listDefinitionsMock },
}));

vi.mock('@/lib/permissions', () => ({
  usePermissions: usePermissionsMock,
}));

import { useIndicatorOverview } from './use-indicator-overview';

/** Every test that does not care about permission gating gets "everything granted" by default. */
function grantAll(): void {
  usePermissionsMock.mockReturnValue({
    permissions: [],
    hasPermission: () => true,
    hasAnyPermission: () => true,
    hasAllPermissions: () => true,
  });
}

/** Builds a `usePermissions()`-shaped return value from an explicit granted list — used by the permission-change test below. */
function grantOnly(granted: readonly string[]): {
  permissions: readonly string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: readonly string[]) => boolean;
  hasAllPermissions: (permissions: readonly string[]) => boolean;
} {
  const set = new Set(granted);
  return {
    permissions: granted,
    hasPermission: (permission) => set.has(permission),
    hasAnyPermission: (permissions) => permissions.some((permission) => set.has(permission)),
    hasAllPermissions: (permissions) => permissions.every((permission) => set.has(permission)),
  };
}

const SUMMARY_FIXTURE = {
  metrics: [
    {
      metricKey: 'ASSET_INACTIVE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 2,
    },
  ],
  breakdowns: { indicators: { monitored: 0, breached: 0 } },
};

const SUMMARY_WITH_INCIDENTS_FIXTURE = {
  metrics: [
    {
      metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
      shape: 'BY_BUCKET' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      valueByBucket: { LOW: 3, MEDIUM: 1, HIGH: 212, CRITICAL: 0 },
    },
  ],
  breakdowns: {},
};

const DEFINITIONS_FIXTURE = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
};

beforeEach(() => {
  getSummaryMock.mockReset();
  listDefinitionsMock.mockReset();
  usePermissionsMock.mockReset();
  grantAll();
});

describe('useIndicatorOverview', () => {
  it('starts in loading status with no data', () => {
    getSummaryMock.mockReturnValue(new Promise(() => undefined));
    listDefinitionsMock.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useIndicatorOverview());

    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeUndefined();
    expect(result.current.isRefreshing).toBe(false);
  });

  it('fires exactly one summary request and one definitions request per load', async () => {
    getSummaryMock.mockResolvedValue(SUMMARY_FIXTURE);
    listDefinitionsMock.mockResolvedValue(DEFINITIONS_FIXTURE);

    const { result } = renderHook(() => useIndicatorOverview());

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(getSummaryMock).toHaveBeenCalledTimes(1);
    expect(listDefinitionsMock).toHaveBeenCalledTimes(1);
  });

  it('reaches success with 11 items and the monitoring block on a clean load', async () => {
    getSummaryMock.mockResolvedValue(SUMMARY_FIXTURE);
    listDefinitionsMock.mockResolvedValue(DEFINITIONS_FIXTURE);

    const { result } = renderHook(() => useIndicatorOverview());

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.data?.items).toHaveLength(11);
    expect(result.current.data?.monitoring).toEqual({ monitored: 0, breached: 0 });
    expect(result.current.definitionsUnavailable).toBe(false);
    expect(result.current.data?.fetchedAt).toBeInstanceOf(Date);
  });

  it('goes to status "error" when the summary request fails, regardless of definitions', async () => {
    getSummaryMock.mockRejectedValue(new Error('network down'));
    listDefinitionsMock.mockResolvedValue(DEFINITIONS_FIXTURE);

    const { result } = renderHook(() => useIndicatorOverview());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeUndefined();
  });

  it('degrades to definitionsUnavailable (not an error) when only the definitions request fails', async () => {
    getSummaryMock.mockResolvedValue(SUMMARY_FIXTURE);
    listDefinitionsMock.mockRejectedValue(new Error('forbidden'));

    const { result } = renderHook(() => useIndicatorOverview());

    await waitFor(() => expect(result.current.status).toBe('success'));

    expect(result.current.definitionsUnavailable).toBe(true);
    expect(result.current.data?.items).toHaveLength(11);
    expect(result.current.data?.items.every((item) => item.threshold === undefined)).toBe(true);
  });

  it('refresh() refetches both requests, sets isRefreshing while keeping the previous data, and clears it after', async () => {
    getSummaryMock.mockResolvedValue(SUMMARY_FIXTURE);
    listDefinitionsMock.mockResolvedValue(DEFINITIONS_FIXTURE);

    const { result } = renderHook(() => useIndicatorOverview());
    await waitFor(() => expect(result.current.status).toBe('success'));
    const firstData = result.current.data;

    let resolveSecondSummary: (value: typeof SUMMARY_FIXTURE) => void = () => undefined;
    getSummaryMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSecondSummary = resolve;
      }),
    );
    listDefinitionsMock.mockResolvedValueOnce(DEFINITIONS_FIXTURE);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isRefreshing).toBe(true));
    // Previous data is kept while refreshing, never cleared to a loading state.
    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe(firstData);

    resolveSecondSummary(SUMMARY_FIXTURE);

    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(getSummaryMock).toHaveBeenCalledTimes(2);
    expect(listDefinitionsMock).toHaveBeenCalledTimes(2);
  });

  it('re-derives navigation links when hasPermission changes, WITHOUT refetching', async () => {
    getSummaryMock.mockResolvedValue(SUMMARY_WITH_INCIDENTS_FIXTURE);
    listDefinitionsMock.mockResolvedValue(DEFINITIONS_FIXTURE);
    usePermissionsMock.mockReturnValue(grantOnly([]));

    const { result, rerender } = renderHook(() => useIndicatorOverview());
    await waitFor(() => expect(result.current.status).toBe('success'));

    const beforeItem = result.current.data?.items.find(
      (item) => item.metricKey === 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
    );
    expect(beforeItem?.recordsHref).toBeUndefined();
    if (beforeItem?.reading.kind === 'buckets') {
      expect(beforeItem.reading.buckets.every((bucket) => bucket.href === undefined)).toBe(true);
    }

    // Permission grant changes — no new fetch is triggered by this alone.
    usePermissionsMock.mockReturnValue(grantOnly(['incident:view']));
    rerender();

    await waitFor(() => {
      const afterItem = result.current.data?.items.find(
        (item) => item.metricKey === 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
      );
      expect(afterItem?.recordsHref).toBe('/incidents?status=OPEN,IN_PROGRESS,RESOLVED');
    });

    const afterItem = result.current.data?.items.find(
      (item) => item.metricKey === 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
    );
    if (afterItem?.reading.kind === 'buckets') {
      expect(afterItem.reading.buckets.find((bucket) => bucket.key === 'HIGH')?.href).toBe(
        '/incidents?status=OPEN,IN_PROGRESS,RESOLVED&severity=HIGH',
      );
    }

    // The whole point: request counts are unchanged by the permission change/rerender above.
    expect(getSummaryMock).toHaveBeenCalledTimes(1);
    expect(listDefinitionsMock).toHaveBeenCalledTimes(1);
  });
});
