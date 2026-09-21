/**
 * 009-indicators-reports, T022 — the sole implementation of
 * `AuditEngagementMetricsPort`
 * (`shared/grc-ports/audit-engagement-metrics.port.ts`). Delegates to
 * `PrismaAuditEngagementRepository.list` — the SAME catalog query
 * `GET /audit-engagements` already runs — with `pageSize: 1` and a
 * `status` filter for the two open values, reading only the page's own
 * `total`.
 */
import { Injectable } from '@nestjs/common';

import { AuditEngagementMetricsPort } from '../../../shared/grc-ports/audit-engagement-metrics.port';
import { OPEN_AUDIT_ENGAGEMENT_STATUSES } from '../domain/audit-engagement.entity';

import { PrismaAuditEngagementRepository } from './prisma-audit-engagement.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class AuditEngagementMetricsAdapter implements AuditEngagementMetricsPort {
  constructor(private readonly auditEngagementRepository: PrismaAuditEngagementRepository) {}

  async getOpenCount(scope: ScopeFilter): Promise<number> {
    const page = await this.auditEngagementRepository.list({
      scope,
      filters: { status: OPEN_AUDIT_ENGAGEMENT_STATUSES },
      sortField: 'code',
      sortDirection: 'asc',
      page: 1,
      pageSize: 1,
    });
    return page.total;
  }
}
