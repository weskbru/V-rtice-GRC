/**
 * T031/005-audit-findings, User Story 1 — `ListAuditScopeUseCase`: the
 * read side of `GET /audits/{auditId}/scope` (`listAuditScope` operation).
 * Requires `audit-engagement:view` and scope over the engagement (checked
 * by the future controller's `@RequirePermission`/access resolver here) —
 * returns the union of all three scope link kinds, newest first. No
 * transaction, no audit entry — reads are not audited (ADR-005).
 */
import { Injectable } from '@nestjs/common';

import { AuditScopeRepositoryPort } from '../../domain/ports/audit-scope-repository.port';
import { AuditEngagementAccessResolver } from '../audit-engagement-access-resolver.service';

import type { AuditScopeEntryRecord } from '../../domain/ports/audit-scope-repository.port';

export interface ListAuditScopeInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
}

@Injectable()
export class ListAuditScopeUseCase {
  constructor(
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly scopeRepository: AuditScopeRepositoryPort,
  ) {}

  async execute(input: ListAuditScopeInput): Promise<readonly AuditScopeEntryRecord[]> {
    // Confirms the engagement exists AND is within the caller's scope
    // (FR-018) before reading its scope — the same non-disclosure gate
    // every other read in this module applies.
    await this.accessResolver.resolveAuditEngagement(input.actorUserId, input.auditEngagementId);

    return this.scopeRepository.listScope(input.auditEngagementId);
  }
}
