import { describe, expect, it, vi } from 'vitest';

import { IncidentMetricsAdapter } from '../../src/modules/incidents/infrastructure/incident-metrics.adapter';

import type { PrismaIncidentRepository } from '../../src/modules/incidents/infrastructure/prisma-incident.repository';
import type { ScopeFilter } from '../../src/shared/persistence/scope-filter';
import type { IncidentStatus } from '@prisma/client';

const GLOBAL_SCOPE: ScopeFilter = { kind: 'GLOBAL' };

describe('IncidentMetricsAdapter.getCountByStatus', () => {
  it('zero-fills every IncidentStatus, even ones the fake repository never reports a nonzero total for', async () => {
    const list = vi
      .fn()
      .mockImplementation((_scope: ScopeFilter, filter: { status: readonly IncidentStatus[] }) => {
        const totalByStatus: Partial<Record<IncidentStatus, number>> = { OPEN: 3, CLOSED: 1 };
        const total = filter.status.reduce((sum, status) => sum + (totalByStatus[status] ?? 0), 0);
        return Promise.resolve({ items: [], page: 1, pageSize: 1, total });
      });
    const adapter = new IncidentMetricsAdapter({ list } as unknown as PrismaIncidentRepository);

    const result = await adapter.getCountByStatus(GLOBAL_SCOPE);

    expect(result).toEqual({
      OPEN: 3,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 1,
      CANCELLED: 0,
    });
    expect(list).toHaveBeenCalledTimes(5);
  });

  it('scopes every one of the five status calls with the SAME scope it received', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 1, total: 0 });
    const adapter = new IncidentMetricsAdapter({ list } as unknown as PrismaIncidentRepository);
    const unitScope: ScopeFilter = { kind: 'UNIT', unitIds: new Set(['unit-1']) };

    await adapter.getCountByStatus(unitScope);

    for (const call of list.mock.calls as unknown[][]) {
      expect(call[0]).toBe(unitScope);
    }
  });
});
