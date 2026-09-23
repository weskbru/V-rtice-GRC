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
    await this.accessResolver.resolveAuditEngagement(input.actorUserId, input.auditEngagementId);

    return this.scopeRepository.listScope(input.auditEngagementId);
  }
}
