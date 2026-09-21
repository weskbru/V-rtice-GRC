/**
 * T071a/002-shared-grc-foundation, US3 — `ReopenFindingUseCase`
 * (`reopenFinding`, FR-027, FR-028). `finding:close` — reopening reverses
 * a closure, so it answers to the same authority
 * (contracts/grc-foundation.openapi.yaml's own description).
 *
 * Legal only from `CLOSED` — enforced by
 * `finding.entity.ts#assertFindingCanBeReopened`, a NARROWER precondition
 * than the general transition table (which also allows `OPEN ->
 * IN_REMEDIATION` as a state-diagram edge; see that function's own header
 * for why reopening specifically requires an actual prior closure to
 * reverse). Reopening a finding that was never closed is `422`, the
 * adversarial case this task requires. Requires a non-empty `reason`.
 *
 * The previous closure is preserved in the audit trail, never in a live
 * column: `closedAt`/`closedByUserId`/`closureJustification` are CLEARED
 * back to `null` on the live row (mirroring
 * `TransitionActionUseCase`'s own `COMPLETED -> OPEN` shape), while this
 * same audit event's `previousValues` carries what they were — so "this
 * finding was closed once, by whom, and why" stays reconstructable
 * (SC-003) even though the live row no longer says so. `reason` itself is
 * not a persisted column on `Finding` at all (data-model.md §5 declares
 * none) — it lives ONLY in `finding.reopened`'s `newValues`, which is why
 * `'reopenReason'` had to be added to `AuditEntityType.FINDING`'s field
 * allow-list (`grc/shared/domain/grc-audit-allowlist.ts`) for this event
 * to actually carry it instead of being silently dropped.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { assertFindingCanBeReopened, assertReopenReasonProvided } from '../domain/finding.entity';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';

export interface ReopenFindingInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly reason: string;
}

@Injectable()
export class ReopenFindingUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ReopenFindingInput): Promise<FindingRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    assertReopenReasonProvided(input.reason);

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

    assertFindingCanBeReopened(current.status);

    return this.transactionRunner.run(async () => {
      const reopened = await this.findingRepository.reopen(scope, input.findingId);
      if (!reopened) {
        throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, input.findingId);
      }

      await this.auditRecorder.record({
        action: 'finding.reopened',
        entityType: AuditEntityType.FINDING,
        entityId: input.findingId,
        actorLabel: actor.fullName,
        previousValues: {
          status: current.status,
          closedAt: current.closedAt ?? null,
          closureJustification: current.closureJustification ?? null,
        },
        newValues: {
          status: 'IN_REMEDIATION',
          closedAt: null,
          closureJustification: null,
          reopenReason: input.reason,
        },
        organizationalUnitId: current.orgUnit.id,
      });

      return reopened;
    });
  }
}
