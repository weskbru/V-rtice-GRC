/**
 * T026/005-audit-findings, User Story 1 — `ListAuditEngagementUseCase`: the
 * read side of `GET /audits` (`listAuditEngagements` operation, FR-018).
 * No transaction, no audit entry — reads are not audited (ADR-005),
 * mirroring `ListControlsUseCase`'s own reasoning.
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import type {
  AuditEngagementListSortDirection,
  AuditEngagementListSortField,
  AuditEngagementRecord,
} from '../domain/ports/audit-engagement-repository.port';
import type { AuditEngagementStatus } from '@prisma/client';

export interface ListAuditEngagementInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: readonly AuditEngagementStatus[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly leadAuditorUserId?: readonly string[] | undefined;
  readonly sortField: AuditEngagementListSortField;
  readonly sortDirection: AuditEngagementListSortDirection;
}

export interface ListAuditEngagementOutput {
  readonly items: readonly AuditEngagementRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListAuditEngagementUseCase {
  constructor(
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListAuditEngagementInput): Promise<ListAuditEngagementOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const { items, total } = await this.auditEngagementRepository.list({
      scope,
      filters: {
        status: input.status,
        orgUnitId: input.orgUnitId,
        leadAuditorUserId: input.leadAuditorUserId,
      },
      sortField: input.sortField,
      sortDirection: input.sortDirection,
      page: input.page,
      pageSize: input.pageSize,
    });

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
