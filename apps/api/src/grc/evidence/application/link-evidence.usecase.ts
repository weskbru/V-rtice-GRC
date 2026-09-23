import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ConflictDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { getEvidenceSubjectAccessor } from '../../shared/domain/ports/evidence-subject-resolver.port';
import { assertLinkNoteWithinBounds } from '../domain/evidence-link.entity';
import { assertEvidenceLinkable } from '../domain/evidence.entity';
import { EvidenceLinkRepositoryPort } from '../domain/ports/evidence-link-repository.port';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import type { VisibleEvidenceLink } from './evidence-link-visibility.service';
import type { EvidenceSubjectType } from '@prisma/client';

export interface LinkEvidenceInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note?: string | undefined;
}

@Injectable()
export class LinkEvidenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly linkRepository: EvidenceLinkRepositoryPort,
    private readonly referenceData: EvidenceReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: LinkEvidenceInput): Promise<VisibleEvidenceLink> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const evidence = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!evidence) {
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
    assertEvidenceLinkable(evidence.status);
    assertLinkNoteWithinBounds(input.note);

    const accessor = getEvidenceSubjectAccessor(input.subjectType);
    const subjectAccess = await accessor.resolveViewableSubject(input.actorUserId, input.subjectId);

    const existing = await this.linkRepository.findActiveLink(
      input.evidenceId,
      input.subjectType,
      input.subjectId,
    );
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.evidence.link.alreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const linkedAt = new Date();
      const link = await this.linkRepository.create({
        evidenceId: input.evidenceId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        note: input.note,
        linkedByUserId: input.actorUserId,
        linkedAt,
      });

      await this.auditRecorder.record({
        action: 'evidence.linked',
        entityType: AuditEntityType.EVIDENCE_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          evidenceId: input.evidenceId,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          note: input.note ?? null,
        },
        organizationalUnitId: evidence.orgUnit.id,
      });

      return { ...link, subjectLabel: subjectAccess.label };
    });
  }
}
