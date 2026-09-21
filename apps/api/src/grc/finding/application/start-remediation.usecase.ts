/**
 * T047/005-audit-findings, US2 — `StartFindingRemediationUseCase`
 * (`startFindingRemediation`, FR-009, SC-002, research.md D-10). The use
 * case that closes the debt named in `finding.entity.ts`'s own header
 * since Phase 1: `OPEN -> IN_REMEDIATION` was always a legal edge in
 * `LEGAL_TRANSITIONS` — `finding.entity.ts` is UNCHANGED by this task,
 * because the gap was never in the model — but no use case in this
 * codebase ever called `assertLegalFindingTransition('OPEN',
 * 'IN_REMEDIATION')` before this one. `POST
 * /findings/{findingId}/start-remediation`, `finding:remediate`.
 *
 * ## Deliberately narrower than the general transition table would allow
 *
 * `assertLegalFindingTransition` alone would also accept a `CLOSED`
 * finding moving to `IN_REMEDIATION` (that is `reopenFinding`'s own edge,
 * `finding.entity.ts#assertFindingCanBeReopened`'s header explains the
 * split). This use case explicitly checks `current.status === 'OPEN'`
 * BEFORE calling the transition assertion, so a `CLOSED`/`ARCHIVED`
 * finding is refused `422` here — "starting remediation" is a distinct
 * business action from "reopening a closed finding" (the contract's own
 * `startFindingRemediation` description: "reopening a closed finding is a
 * different operation ... with its own precondition and reason
 * requirement, not this one"). `IN_REMEDIATION` itself is refused too —
 * the edge only fires once per open finding, not idempotently.
 *
 * No request body, no extra invariant: unlike closing (Invariants F1/F2/F5)
 * or reopening (a required `reason`), beginning remediation carries no
 * precondition beyond "this finding is currently OPEN" — those richer
 * invariants belong to CLOSING a finding, not to starting its remediation
 * (research.md D-10's own text: "Nenhuma outra invariante — sem
 * segregação de funções, sem exigência de evidência").
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { assertLegalFindingTransition } from '../domain/finding.entity';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';

export interface StartFindingRemediationInput {
  readonly actorUserId: string;
  readonly findingId: string;
}

@Injectable()
export class StartFindingRemediationUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: StartFindingRemediationInput): Promise<FindingRecord> {
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

    // Narrower than the general table (this file's own header): only
    // `OPEN` may start remediation through THIS operation — a `CLOSED`
    // finding also satisfies the general table's own `OPEN`/`CLOSED ->
    // IN_REMEDIATION` edges, but reopening a closed finding is a
    // different, dedicated operation (`ReopenFindingUseCase`).
    if (current.status !== 'OPEN') {
      throw new ValidationDomainError(USER_MESSAGES.findings.transition.notAllowed, [
        { field: 'status', message: USER_MESSAGES.findings.transition.notAllowed },
      ]);
    }
    assertLegalFindingTransition(current.status, 'IN_REMEDIATION');

    return this.transactionRunner.run(async () => {
      const updated = await this.findingRepository.startRemediation(scope, input.findingId);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, input.findingId);
      }

      await this.auditRecorder.record({
        action: 'finding.remediation_started',
        entityType: AuditEntityType.FINDING,
        entityId: input.findingId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: { status: 'IN_REMEDIATION' },
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }
}
