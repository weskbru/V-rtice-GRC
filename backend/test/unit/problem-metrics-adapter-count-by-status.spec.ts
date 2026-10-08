import { describe, expect, it, vi } from 'vitest';

import { ProblemMetricsAdapter } from '../../src/modules/problems/infrastructure/problem-metrics.adapter';

import type { PrismaProblemRepository } from '../../src/modules/problems/infrastructure/prisma-problem.repository';
import type { ScopeFilter } from '../../src/shared/persistence/scope-filter';
import type { ProblemStatus } from '@prisma/client';

const GLOBAL_SCOPE: ScopeFilter = { kind: 'GLOBAL' };

describe('ProblemMetricsAdapter.getCountByStatus', () => {
  it('zero-fills every ProblemStatus, even ones the fake repository never reports a nonzero total for', async () => {
    const list = vi
      .fn()
      .mockImplementation((_scope: ScopeFilter, filter: { status: readonly ProblemStatus[] }) => {
        const totalByStatus: Partial<Record<ProblemStatus, number>> = { IN_ANALYSIS: 2 };
        const total = filter.status.reduce((sum, status) => sum + (totalByStatus[status] ?? 0), 0);
        return Promise.resolve({ items: [], total });
      });
    const adapter = new ProblemMetricsAdapter({ list } as unknown as PrismaProblemRepository);

    const result = await adapter.getCountByStatus(GLOBAL_SCOPE);

    expect(result).toEqual({
      OPEN: 0,
      IN_ANALYSIS: 2,
      RESOLVED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    });
    expect(list).toHaveBeenCalledTimes(5);
  });

  it('scopes every one of the five status calls with the SAME scope it received', async () => {
    const list = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const adapter = new ProblemMetricsAdapter({ list } as unknown as PrismaProblemRepository);
    const unitScope: ScopeFilter = { kind: 'UNIT', unitIds: new Set(['unit-1']) };

    await adapter.getCountByStatus(unitScope);

    for (const call of list.mock.calls as unknown[][]) {
      expect(call[0]).toBe(unitScope);
    }
  });
});
