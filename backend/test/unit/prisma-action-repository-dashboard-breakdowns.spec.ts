import { describe, expect, it, vi } from 'vitest';

import { PrismaActionRepository } from '../../src/grc/action/infrastructure/prisma-action.repository';

import type { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import type { ScopeFilter } from '../../src/shared/persistence/scope-filter';

const GLOBAL_SCOPE: ScopeFilter = { kind: 'GLOBAL' };
const UNIT_SCOPE: ScopeFilter = { kind: 'UNIT', unitIds: new Set(['unit-1']) };

describe('PrismaActionRepository.getStatusBreakdown', () => {
  it('zero-fills every ActionStatus, even ones groupBy never returns a row for', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { status: 'OPEN', _count: { _all: 3 } },
      { status: 'COMPLETED', _count: { _all: 5 } },
    ]);
    const prisma = { client: { action: { groupBy } } } as unknown as PrismaService;
    const repository = new PrismaActionRepository(prisma);

    const result = await repository.getStatusBreakdown(GLOBAL_SCOPE);

    expect(result).toEqual({ OPEN: 3, IN_PROGRESS: 0, COMPLETED: 5, CANCELLED: 0 });
  });

  it('applies the caller scope to the groupBy where clause', async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const prisma = { client: { action: { groupBy } } } as unknown as PrismaService;
    const repository = new PrismaActionRepository(prisma);

    await repository.getStatusBreakdown(UNIT_SCOPE);

    expect(groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { orgUnitId: { in: ['unit-1'] } },
      _count: { _all: true },
    });
  });
});

describe('PrismaActionRepository.countDueSoonInScope', () => {
  it('filters status IN (OPEN, IN_PROGRESS) — the SAME OVERDUE_ELIGIBLE_ACTION_STATUSES set countOverdueInScope uses — and dueOn in [fromInclusive, toExclusive)', async () => {
    const count = vi.fn().mockResolvedValue(4);
    const prisma = { client: { action: { count } } } as unknown as PrismaService;
    const repository = new PrismaActionRepository(prisma);
    const from = new Date('2026-09-12T00:00:00.000Z');
    const to = new Date('2026-09-19T00:00:00.000Z');

    const result = await repository.countDueSoonInScope(GLOBAL_SCOPE, from, to);

    expect(result).toBe(4);
    expect(count).toHaveBeenCalledWith({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueOn: { gte: from, lt: to },
      },
    });
  });

  it('applies the caller scope to the count where clause', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { client: { action: { count } } } as unknown as PrismaService;
    const repository = new PrismaActionRepository(prisma);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-08T00:00:00.000Z');

    await repository.countDueSoonInScope(UNIT_SCOPE, from, to);

    expect(count).toHaveBeenCalledWith({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        dueOn: { gte: from, lt: to },
        orgUnitId: { in: ['unit-1'] },
      },
    });
  });
});
