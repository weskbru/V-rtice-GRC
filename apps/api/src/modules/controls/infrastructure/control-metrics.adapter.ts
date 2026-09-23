import { Injectable } from '@nestjs/common';

import { ControlMetricsPort } from '../../../shared/grc-ports/control-metrics.port';

import { ControlQueryService } from './control-query.service';

import type { ControlSummaryCounts } from '../../../shared/grc-ports/control-metrics.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlStatus } from '@prisma/client';

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
