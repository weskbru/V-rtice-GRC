import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { EvidenceLinkRepositoryPort } from '../../evidence/domain/ports/evidence-link-repository.port';
import {
  assertCloserNotResponsibleForCompletedAction,
  assertFindingCloseRequirementMet,
  assertFindingHasSupportingEvidence,
  assertLegalFindingTransition,
} from '../domain/finding.entity';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';

export interface CloseFindingInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly justification?: string | undefined;
}

@Injectable()
export class CloseFindingUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly evidenceLinkRepository: EvidenceLinkRepositoryPort,
  ) {}

  async execute(input: CloseFindingInput): Promise<FindingRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const current = await this.findingRepository.findById(scope, input.findingId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          entityLabel: USER_MESSAGES.findings.entityLabel,
        },
        () => this.findingRepository.findOrgUnitIdUnscoped(input.findingId),
      );
    }

    assertLegalFindingTransition(current.status, 'CLOSED');

    const completedActionResponsibles =
      await this.findingRepository.findCompletedLinkedActionResponsibles(input.findingId);

    assertFindingCloseRequirementMet(completedActionResponsibles.length > 0, input.justification);

    const hasActiveEvidenceLink = await this.evidenceLinkRepository.hasActiveLinkForSubject(
      'FINDING',
      input.findingId,
    );
    assertFindingHasSupportingEvidence(hasActiveEvidenceLink);

    try {
      assertCloserNotResponsibleForCompletedAction(input.actorUserId, completedActionResponsibles);
    } catch (error) {
      if (error instanceof ForbiddenDomainError) {
        await this.recordSegregationOfDutiesDenial(current, actor.fullName);
      }
      throw error;
    }

    const justification =
      input.justification && input.justification.trim().length > 0 ? input.justification : null;

    return this.transactionRunner.run(async () => {
      const closedAt = new Date();
      const closed = await this.findingRepository.close(scope, input.findingId, {
        closedAt,
        closedByUserId: input.actorUserId,
        closureJustification: justification,
      });
      if (!closed) {
        throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, input.findingId);
      }

      await this.auditRecorder.record({
        action: 'finding.closed',
        entityType: AuditEntityType.FINDING,
        entityId: input.findingId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status, closedAt: null, closureJustification: null },
        newValues: { status: 'CLOSED', closedAt, closureJustification: justification },
        organizationalUnitId: current.orgUnit.id,
      });

      return closed;
    });
  }

  private async recordSegregationOfDutiesDenial(
    finding: FindingRecord,
    actorLabel: string,
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'finding.close_denied',
        entityType: AuditEntityType.FINDING,
        entityId: finding.id,
        actorLabel,
        organizationalUnitId: finding.orgUnit.id,
        outcome: 'DENIED',
      });
    });
  }
}
