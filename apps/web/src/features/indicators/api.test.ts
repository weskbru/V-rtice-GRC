import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Unit evidence for `indicatorsApi` (009-indicators-reports, T062) — the
 * only piece of this module with logic worth a dedicated test:
 * `buildDefinitionListQueryString` inside `listDefinitions`, which must
 * omit `isActive` entirely when the caller did not choose a value (never
 * emit `isActive=undefined`). Mocks `@/lib/api-client` the same way
 * `app/(public)/login/login-form.test.tsx` does, since this module has no
 * React tree to mount.
 */
const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: getMock, post: postMock },
}));

import { indicatorsApi } from './api';

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
});

describe('indicatorsApi.listDefinitions', () => {
  it('always sets page and pageSize', async () => {
    getMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await indicatorsApi.listDefinitions({ page: 2, pageSize: 50 });

    expect(getMock).toHaveBeenCalledWith('/indicators?page=2&pageSize=50');
  });

  it('omits isActive from the query string when the caller did not set it', async () => {
    getMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await indicatorsApi.listDefinitions({ page: 1, pageSize: 20 });

    const calledUrl = getMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain('isActive');
  });

  it('includes isActive=true and isActive=false explicitly when the caller set them', async () => {
    getMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await indicatorsApi.listDefinitions({ page: 1, pageSize: 20, isActive: true });
    expect(getMock).toHaveBeenLastCalledWith('/indicators?page=1&pageSize=20&isActive=true');

    await indicatorsApi.listDefinitions({ page: 1, pageSize: 20, isActive: false });
    expect(getMock).toHaveBeenLastCalledWith('/indicators?page=1&pageSize=20&isActive=false');
  });
});

describe('indicatorsApi.createDefinition', () => {
  it('posts the request body as-is to /indicators', async () => {
    const body = {
      metricKey: 'RISK_TOTAL_BY_LEVEL' as const,
      name: 'Riscos por nível',
      description: 'Contagem de riscos por nível',
      ownerUserId: 'user-1',
    };
    postMock.mockResolvedValue({ id: 'def-1' });

    await indicatorsApi.createDefinition(body);

    expect(postMock).toHaveBeenCalledWith('/indicators', body);
  });
});

describe('indicatorsApi.getCurrentValue', () => {
  it('reads the metric current value by metricKey', async () => {
    getMock.mockResolvedValue({ metricKey: 'CONTROL_INACTIVE_COUNT' });

    await indicatorsApi.getCurrentValue('CONTROL_INACTIVE_COUNT');

    expect(getMock).toHaveBeenCalledWith('/indicators/CONTROL_INACTIVE_COUNT/current');
  });
});

describe('indicatorsApi.createMeasurement', () => {
  it('posts to .../measurements with no request body', async () => {
    postMock.mockResolvedValue({ id: 'msr-1' });

    await indicatorsApi.createMeasurement('RISK_TREATMENT_OVERDUE_COUNT');

    expect(postMock).toHaveBeenCalledWith('/indicators/RISK_TREATMENT_OVERDUE_COUNT/measurements');
  });
});

describe('indicatorsApi.listMeasurements', () => {
  it('reads the paginated history by metricKey', async () => {
    getMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    await indicatorsApi.listMeasurements('RISK_TREATMENT_OVERDUE_COUNT', { page: 2, pageSize: 50 });

    expect(getMock).toHaveBeenCalledWith(
      '/indicators/RISK_TREATMENT_OVERDUE_COUNT/measurements?page=2&pageSize=50',
    );
  });
});
