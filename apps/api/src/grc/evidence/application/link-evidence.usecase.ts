/**
 * T033/002-shared-grc-foundation, US1 — `LinkEvidenceUseCase`
 * (`linkEvidence`, FR-007, FR-008, FR-031, R-001, R-010). The use case that
 * proves the hardest guarantee in this feature: **both sides authorized,
 * before the row is written, with no foreign key on the subject side.**
 *
 * ## The two independent checks, and why neither substitutes for the other
 *
 * 1. **Evidence side**: `@RequirePermission('evidence:link')` at the
 *    controller boundary, PLUS `EvidenceRepositoryPort.findById(scope, ...)`
 *    here — an evidence outside the caller's scope is `undefined`,
 *    indistinguishable from unknown (FR-032).
 * 2. **Subject side**: `EvidenceSubjectResolverPort`'s registered accessor
 *    for `subjectType` — `resolveViewableSubject` internally re-derives
 *    BOTH the subject's own view permission (e.g. `risk:view`) and its
 *    organizational scope, exactly the two-check shape
 *    `RiskParentRecordAccessor` already establishes for attachments/
 *    comments (see that file's own header for why a caller with global
 *    scope but no view permission at all must still be refused). It throws
 *    `NotFoundDomainError` for every reason the actor may not proceed,
 *    which is exactly what lets this use case simply propagate that error
 *    without ever having to ask "was it missing, out of scope, or lacking
 *    permission" — SC-005 requires the three be indistinguishable, and
 *    letting the SAME exception type flow through unmodified is what
 *    guarantees that, rather than three call sites each having to
 *    reconstruct byte-identical wording.
 *
 * Neither check is inferred from the other (R-010's own stated
 * requirement) — a caller who can see the evidence but not the subject, or
 * the reverse, is refused either way; adversarial tests prove both
 * directions.
 */
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

    // Evidence side (1/2). F-38: recorded server-side, via
    // `assertExistingRecordAccessible`, whenever the evidence actually
    // exists outside `scope`.
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

    // Subject side (2/2) — see this file's own header for why this single
    // call covers both the subject's view permission and its scope.
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
        // The evidence's own org unit — `EvidenceLink` belongs to
        // `Evidence` (data-model.md §1's own diagram: `Evidence --1:N-->
        // EvidenceLink`), the same "owning side's org unit" convention
        // `LinkControlUseCase` applies via `result.record.orgUnit.id`.
        organizationalUnitId: evidence.orgUnit.id,
      });

      return { ...link, subjectLabel: subjectAccess.label };
    });
  }
}
