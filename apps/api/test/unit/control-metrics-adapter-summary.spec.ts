/**
 * Unit test for `ControlMetricsAdapter.getSummary`
 * (`src/modules/controls/infrastructure/control-metrics.adapter.ts`), added
 * for `GET /dashboard/summary`'s `breakdowns.controls`
 * (`get-dashboard-summary.usecase.ts`). `ControlQueryService.listCatalog`
 * is a hand-rolled fake — no I/O, no NestJS test module, no real
 * `controlEffectivenessExpression` SQL. The fact this file exists to prove:
 * `getSummary` issues exactly THREE `listCatalog` calls (unfiltered,
 * `status: ['ACTIVE']`, and `status: ['ACTIVE'] + effectiveness:
 * ['INEFFECTIVE']`) and reads each one's own `total` — never a fourth call,
 * never a client-side re-count.
 */
import { describe, expect, it, vi } from 'vitest';

import { ControlMetricsAdapter } from '../../src/modules/controls/infrastructure/control-metrics.adapter';

import type { ControlCatalogQuery } from '../../src/modules/controls/domain/ports/control-query.port';
import type { ControlQueryService } from '../../src/modules/controls/infrastructure/control-query.service';
import type { ScopeFilter } from '../../src/shared/persistence/scope-filter';

const GLOBAL_SCOPE: ScopeFilter = { kind: 'GLOBAL' };

describe('ControlMetricsAdapter.getSummary', () => {
  it('resolves total/active/ineffective from three parallel listCatalog calls, each reading only its own total', async () => {
    const listCatalog = vi.fn().mockImplementation((query: ControlCatalogQuery) => {
      const { status, effectiveness } = query.filters;
      if (effectiveness?.includes('INEFFECTIVE')) {
        return Promise.resolve({ items: [], total: 2 });
      }
      if (status?.length === 1 && status[0] === 'ACTIVE') {
        return Promise.resolve({ items: [], total: 8 });
      }
      return Promise.resolve({ items: [], total: 10 });
    });
    const adapter = new ControlMetricsAdapter({
      listCatalog,
    } as unknown as ControlQueryService);

    const result = await adapter.getSummary(GLOBAL_SCOPE);

    expect(result).toEqual({ total: 10, active: 8, ineffective: 2 });
    expect(listCatalog).toHaveBeenCalledTimes(3);

    const filtersSeen = (listCatalog.mock.calls as [ControlCatalogQuery][]).map(
      ([query]) => query.filters,
    );
    expect(filtersSeen).toContainEqual({});
    expect(filtersSeen).toContainEqual({ status: ['ACTIVE'] });
    expect(filtersSeen).toContainEqual({ status: ['ACTIVE'], effectiveness: ['INEFFECTIVE'] });
  });

  it('forwards the SAME scope to every one of the three calls', async () => {
    const listCatalog = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const adapter = new ControlMetricsAdapter({
      listCatalog,
    } as unknown as ControlQueryService);
    const unitScope: ScopeFilter = { kind: 'UNIT', unitIds: new Set(['unit-1']) };

    await adapter.getSummary(unitScope);

    for (const call of listCatalog.mock.calls as [ControlCatalogQuery][]) {
      expect(call[0].scope).toBe(unitScope);
    }
  });
});
