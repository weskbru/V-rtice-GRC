/**
 * T071a/002-shared-grc-foundation, US3 — `ArchiveFindingUseCase`
 * (`archiveFinding`, FR-027, Invariant F4). `finding:administer`.
 *
 * **Invariant F4**: only a `CLOSED` finding may be archived —
 * `assertLegalFindingTransition(current.status, 'ARCHIVED')` rejects
 * every status but `CLOSED` (`ARCHIVED` appears in no other status's
 * target set in `finding.entity.ts`'s transition table), so archiving can
 * never become a shortcut past closure and its segregation-of-duties rule
 * (F2) — an `OPEN`/`IN_REMEDIATION` finding answers `422`, the
 * adversarial case this task requires. Never deletes: linked evidence and
 * actions stay queryable exactly like `ArchiveEvidenceUseCase`'s own
 * guarantee.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { assertLegalFindingTransition } from '../domain/finding.entity';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';

export interface ArchiveFindingInput {
  readonly actorUserId: string;
  readonly findingId: string;
}

@Injectable()
export class ArchiveFindingUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ArchiveFindingInput): Promise<FindingRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the finding actually exists outside `scope`.
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

    assertLegalFindingTransition(current.status, 'ARCHIVED');

    return this.transactionRunner.run(async () => {
      const archivedAt = new Date();
      const archived = await this.findingRepository.archive(
        scope,
        input.findingId,
        input.actorUserId,
        archivedAt,
      );
      if (!archived) {
        throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, input.findingId);
      }

      await this.auditRecorder.record({
        action: 'finding.archived',
        entityType: AuditEntityType.FINDING,
        entityId: input.findingId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status, archivedAt: null },
        newValues: { status: 'ARCHIVED', archivedAt },
        organizationalUnitId: current.orgUnit.id,
      });

      return archived;
    });
  }
}
