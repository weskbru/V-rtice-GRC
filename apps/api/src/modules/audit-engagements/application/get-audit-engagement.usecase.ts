import { Injectable } from '@nestjs/common';

import { AuditEngagementAccessResolver } from './audit-engagement-access-resolver.service';

import type { AuditEngagementRecord } from '../domain/ports/audit-engagement-repository.port';

export interface GetAuditEngagementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
}

@Injectable()
export class GetAuditEngagementUseCase {
  constructor(private readonly accessResolver: AuditEngagementAccessResolver) {}

  async execute(input: GetAuditEngagementInput): Promise<AuditEngagementRecord> {
    const { auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );
    return auditEngagement;
  }
}
