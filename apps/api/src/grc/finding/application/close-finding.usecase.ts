/**
 * T071/002-shared-grc-foundation, US3 — `CloseFindingUseCase`
 * (`closeFinding`, FR-024, FR-025, FR-026, FR-028). The security-critical
 * use case of this task: segregation of duties on closure.
 *
 * ## Order of checks
 *
 * 1. Actor must exist (`finding:close` itself already checked by
 *    `@RequirePermission` at the controller).
 * 2. Scoped read of the finding — out-of-scope/unknown is `404`
 *    (SC-005), same as every other capability.
 * 3. `assertLegalFindingTransition(current.status, 'CLOSED')` —
 *    `finding.entity.ts`'s transition table: legal from `OPEN` or
 *    `IN_REMEDIATION` only. An already-`CLOSED`/`ARCHIVED` finding is
 *    `422`, never silently accepted as a no-op (a second `closeFinding`
 *    call on an already-closed finding would otherwise silently let a
 *    DIFFERENT actor's closure overwrite the first one's, defeating F2).
 * 4. **Invariant F1**: at least one linked `COMPLETED` action (queried via
 *    `FindingRepositoryPort.findCompletedLinkedActionResponsibles`) OR a
 *    non-empty `justification` — `assertFindingCloseRequirementMet`, 422.
 * 5. **Invariant F5** (T051/005-audit-findings, FR-010, ADDITIVE to F1,
 *    never a substitute): at least one ACTIVE `EvidenceLink` for this
 *    finding — `EvidenceLinkRepositoryPort.hasActiveLinkForSubject`,
 *    `assertFindingHasSupportingEvidence`, 422.
 * 6. **Invariant F2 — segregation of duties**: the closer may not be the
 *    `responsibleUserId` of ANY of those completed actions —
 *    `assertCloserNotResponsibleForCompletedAction`, 403. Checked with the
 *    SAME list step 4 already fetched — one query answers both F1 and F2,
 *    never two separate round-trips that could disagree.
 *
 * F5 is deliberately checked BEFORE F2, not after: quickstart.md §6 (the
 * segregation-of-duties scenario exercised by the real producer) lists
 * "evidência anexada" as an explicit PRECONDITION of the 403 it expects —
 * if F2 fired first, that precondition would be pointless. Placing F5
 * between F1 and F2 also means a finding that satisfies F1 (a completed
 * action or a justification) but carries no evidence at all is refused
 * `422` REGARDLESS of who is attempting to close it, before segregation
 * of duties is even evaluated.
 *
 * Completing every linked action never triggers this use case on its own
 * (Invariant F3, `finding.entity.ts`'s own header) — this is always an
 * explicit, actor-attributed `POST /findings/{id}/close` call.
 *
 * ## The F2 refusal is itself audited (unlike a plain 422 validation error)
 *
 * `assertApproverDiffersFromRequester`'s own segregation-of-duties refusal
 * (`modules/risk/domain/approval.ts`) writes no dedicated audit row — the
 * exception itself is the only trace. This use case deliberately does
 * MORE: an F2 refusal is a signal someone attempted to close a finding
 * they are not entitled to close, worth its own trail distinct from "the
 * caller lacked `finding:close` entirely" (that case is already covered by
 * `PermissionGuard`'s own `DENIED`-audit seam,
 * `audit-permission-denial-recorder.ts`, which never runs for THIS
 * business-rule refusal — it happens deep inside the use case, after the
 * permission check already passed). `recordSegregationOfDutiesDenial`
 * below writes a `finding.close_denied` row with `outcome: DENIED` in its
 * own short-lived transaction (mirroring
 * `AuditPermissionDenialRecorder`'s own documented technique for auditing
 * a refusal that has no ambient business-write transaction to join), then
 * the original `ForbiddenDomainError` is rethrown unchanged.
 */
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

    assertLegalFindingTransition(current.status, 'CLOSED');

    const completedActionResponsibles =
      await this.findingRepository.findCompletedLinkedActionResponsibles(input.findingId);

    assertFindingCloseRequirementMet(completedActionResponsibles.length > 0, input.justification);

    // Invariant F5 (T051/005-audit-findings, FR-010) — additive, checked
    // BEFORE F2 (see this file's header for why: quickstart.md §6's own
    // segregation-of-duties scenario lists evidence as a precondition of
    // the 403 it expects).
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

  /** See this file's own header, "The F2 refusal is itself audited" — a
   * short-lived, audit-only transaction, since there is no ambient
   * business-write transaction to join at the point F2 refuses. */
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
