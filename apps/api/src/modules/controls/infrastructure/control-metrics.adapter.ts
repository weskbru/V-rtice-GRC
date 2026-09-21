/**
 * 009-indicators-reports, T020 — the sole implementation of
 * `ControlMetricsPort` (`shared/grc-ports/control-metrics.port.ts`).
 * Delegates to `ControlQueryService.listCatalog` — the SAME catalog query
 * `GET /controls` already runs — with `pageSize: 1` and a `status` filter
 * for the three non-`ACTIVE` values, reading only the page's own `total`
 * (a `COUNT(*) OVER()` already computed by that query, per its own
 * header) rather than writing a second aggregate.
 */
import { Injectable } from '@nestjs/common';

import { ControlMetricsPort } from '../../../shared/grc-ports/control-metrics.port';

import { ControlQueryService } from './control-query.service';

import type { ControlSummaryCounts } from '../../../shared/grc-ports/control-metrics.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlStatus } from '@prisma/client';

/** Every `ControlStatus` value except `ACTIVE` (`schema.prisma`'s
 * four-value enum) — "inactive" for this indicator's purposes. */
const INACTIVE_CONTROL_STATUSES: readonly ControlStatus[] = ['DRAFT', 'SUSPENDED', 'RETIRED'];

@Injectable()
export class ControlMetricsAdapter implements ControlMetricsPort {
  constructor(private readonly controlQuery: ControlQueryService) {}

  async getInactiveCount(scope: ScopeFilter): Promise<number> {
    const page = await this.controlQuery.listCatalog({
      scope,
      filters: { status: INACTIVE_CONTROL_STATUSES },
      sort: { field: 'code', direction: 'asc' },
      page: 1,
      pageSize: 1,
      referenceDate: new Date(),
    });
    return page.total;
  }

  /**
   * `GET /dashboard/summary`'s `breakdowns.controls` — three
   * `listCatalog` calls (`pageSize: 1`, reading only `total`), run in
   * parallel: unfiltered, `status: ['ACTIVE']`, and `status: ['ACTIVE']`
   * plus `effectiveness: ['INEFFECTIVE']`. The `effectiveness` filter is
   * `ControlQueryService`'s own `effectivenessFragment`, built from the
   * SAME `controlEffectivenessExpression` the catalog's `SELECT`/`ORDER
   * BY` use (that service's own header) — never a second effectiveness
   * computation, CLAUDE.md §19.7.
   */
  async getSummary(scope: ScopeFilter): Promise<ControlSummaryCounts> {
    const referenceDate = new Date();
    const [totalPage, activePage, ineffectivePage] = await Promise.all([
      this.controlQuery.listCatalog({
        scope,
        filters: {},
        sort: { field: 'code', direction: 'asc' },
        page: 1,
        pageSize: 1,
        referenceDate,
      }),
      this.controlQuery.listCatalog({
        scope,
        filters: { status: ['ACTIVE'] },
        sort: { field: 'code', direction: 'asc' },
        page: 1,
        pageSize: 1,
        referenceDate,
      }),
      this.controlQuery.listCatalog({
        scope,
        filters: { status: ['ACTIVE'], effectiveness: ['INEFFECTIVE'] },
        sort: { field: 'code', direction: 'asc' },
        page: 1,
        pageSize: 1,
        referenceDate,
      }),
    ]);

    return {
      total: totalPage.total,
      active: activePage.total,
      ineffective: ineffectivePage.total,
    };
  }
}
