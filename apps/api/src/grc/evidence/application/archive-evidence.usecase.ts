import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import type { EvidenceRecord } from '../domain/ports/evidence-repository.port';

export interface ArchiveEvidenceInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
}

@Injectable()
export class ArchiveEvidenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly referenceData: EvidenceReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ArchiveEvidenceInput): Promise<EvidenceRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const current = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.EVIDENCE,
          entityId: input.evidenceId,
          entityLabel: USER_MESSAGES.evidence.entityLabel,
        },
        () => this.evidenceRepository.findOrgUnitIdUnscoped(input.evidenceId),
      );
    }

    if (current.status === 'ARCHIVED') {
      throw new ConflictDomainError(USER_MESSAGES.evidence.alreadyArchived);
    }

    return this.transactionRunner.run(async () => {
      const archivedAt = new Date();
      const archived = await this.evidenceRepository.archive(
        scope,
        input.evidenceId,
        input.actorUserId,
        archivedAt,
      );
      if (!archived) {
        throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, input.evidenceId);
      }

      await this.auditRecorder.record({
        action: 'evidence.archived',
        entityType: AuditEntityType.EVIDENCE,
        entityId: input.evidenceId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status, archivedAt: null },
        newValues: { status: 'ARCHIVED', archivedAt },
        organizationalUnitId: current.orgUnit.id,
      });

      return archived;
    });
  }
}
