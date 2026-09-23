import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { EvidenceLinkRepositoryPort } from '../domain/ports/evidence-link-repository.port';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import type { EvidenceLinkRecord } from '../domain/ports/evidence-link-repository.port';

export interface UnlinkEvidenceInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkEvidenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly linkRepository: EvidenceLinkRepositoryPort,
    private readonly referenceData: EvidenceReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UnlinkEvidenceInput): Promise<EvidenceLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const evidence = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!evidence) {
      throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, input.evidenceId);
    }

    const link = await this.linkRepository.findById(input.evidenceId, input.linkId);
    if (!link || link.unlinkedAt !== undefined) {
      throw new NotFoundDomainError(USER_MESSAGES.evidence.linkEntityLabel, input.linkId);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      const unlinked = await this.linkRepository.unlink(
        input.linkId,
        input.actorUserId,
        unlinkedAt,
      );

      await this.auditRecorder.record({
        action: 'evidence.unlinked',
        entityType: AuditEntityType.EVIDENCE_LINK,
        entityId: input.linkId,
        actorLabel: actor.fullName,
        previousValues: { unlinkedAt: null },
        newValues: { unlinkedAt },
        organizationalUnitId: evidence.orgUnit.id,
      });

      return unlinked;
    });
  }
}
