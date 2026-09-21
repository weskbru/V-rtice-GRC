/**
 * T026/005-audit-findings, User Story 1 — `GetAuditEngagementUseCase`: the
 * read side of `GET /audits/{auditId}` (`getAuditEngagement` operation,
 * FR-018, US1 AS5). Mirrors `modules/controls/application/get-control.usecase.ts`
 * exactly — no transaction, no audit entry (a read is never audited,
 * ADR-005); a scope denial IS recorded, via
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` (F-38's
 * mechanism), whenever the engagement genuinely exists outside the
 * caller's scope. FR-004's own "permanece integralmente legível" is
 * satisfied by construction — this use case applies no status-based gate
 * at all.
 */
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
