import { Injectable } from '@nestjs/common';

import { FindingRepositoryPort } from '../../../grc/finding/domain/ports/finding-repository.port';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { FindingRecord } from '../../../grc/finding/domain/ports/finding-repository.port';
import type { FindingStatus } from '@prisma/client';

export interface ListAuditEngagementFindingsInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly status?: FindingStatus | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditEngagementFindingsPage {
  readonly items: readonly FindingRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListAuditEngagementFindingsUseCase {
  constructor(
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly findingRepository: FindingRepositoryPort,
  ) {}

  async execute(input: ListAuditEngagementFindingsInput): Promise<AuditEngagementFindingsPage> {
    const { scope } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    const page = await this.findingRepository.list(
      scope,
      { status: input.status, auditEngagementId: input.auditEngagementId },
      input.page,
      input.pageSize,
    );

    return {
      items: page.items,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.total === 0 ? 0 : Math.ceil(page.total / page.pageSize),
    };
  }
}
