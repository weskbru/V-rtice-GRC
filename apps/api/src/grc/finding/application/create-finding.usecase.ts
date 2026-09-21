/**
 * T070/002-shared-grc-foundation, US3 — `CreateFindingUseCase`
 * (`createFinding`, FR-020, FR-021, FR-031, ADR-005). Mirrors
 * `grc/evidence/application/create-evidence.usecase.ts`'s shape — see that
 * file's header for the transaction-boundary reasoning this one does not
 * repeat.
 *
 * ## Order of checks
 *
 * 1. `orgUnitId` must exist, be active, and lie within the caller's
 *    authorized scope (FR-031) — `422`, not `404` (no existing record's
 *    existence could be disclosed at creation time). Assurance fix
 *    (confirmed breach): existence and scope failures throw the identical
 *    `orgUnitNotFound` message — see
 *    `grc/evidence/application/create-evidence.usecase.ts`'s own header
 *    for the full reasoning (this endpoint's contract makes the same
 *    "answered as not-found" promise Evidence's does).
 * 2. `ownerUserId` must exist and be active (referential integrity).
 *
 * Always created `status = OPEN` — `CreateFindingRequest`
 * (contracts/grc-foundation.openapi.yaml) has no `status` field at all.
 *
 * ## T042/005-audit-findings — `auditEngagementId`, additive
 *
 * `CreateFindingFromEngagementUseCase`
 * (`modules/audit-engagements/application/create-finding-from-engagement.usecase.ts`)
 * DELEGATES to this use case rather than duplicating it (CLAUDE.md §19.7:
 * one calculator, never a second copy of a business rule) — Finding is a
 * GRC-kernel capability (`grc/finding`, ADR-016), and a business module
 * depending on it directly is the SAME accepted shape `modules/risk`
 * already establishes for `grc/action`
 * (`modules/risk/application/treatment-actions/create-treatment-action.usecase.ts`).
 * The caller supplies `orgUnitId` as the ENGAGEMENT's own organizational
 * unit (never a client-supplied value — `CreateFindingFromEngagementRequest`
 * has no `orgUnitId` field at all) and `auditEngagementId` as that
 * engagement's id; every other check below (owner active, org unit active/
 * in scope, code generation, transaction boundary) runs unchanged and is
 * NOT re-implemented by the caller. `auditEngagementId` is `undefined` for
 * the manual path (`FindingController.create`, FR-008) — the finding is
 * then persisted with `auditEngagementId = null` (`FindingRepositoryPort
 * .create`) and reported that way in every future read
 * (`FindingResponseMapper`, T089).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { isOrgUnitWithinScope } from '../../shared/domain/org-scope';
import { EntityCodeGeneratorPort } from '../../shared/domain/ports/entity-code-generator.port';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { FindingRecord } from '../domain/ports/finding-repository.port';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
} from '@prisma/client';

export interface CreateFindingInput {
  readonly actorUserId: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation?: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: string;
  /** `undefined` for the manual path (FR-008) — see this file's header,
   * "T042/005-audit-findings" section. */
  readonly auditEngagementId?: string | undefined;
}

@Injectable()
export class CreateFindingUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateFindingInput): Promise<FindingRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const owner = await this.referenceData.findUser(input.ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.findings.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.findings.ownerNotFound },
      ]);
    }

    const identifiedOn = parseIsoDate(input.identifiedOn);
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('FND', codeYear);

      const record = await this.findingRepository.create({
        code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        recommendation: input.recommendation,
        category: input.category,
        origin: input.origin,
        severity: input.severity,
        priority: input.priority,
        ownerUserId: input.ownerUserId,
        identifiedOn,
        auditEngagementId: input.auditEngagementId,
      });

      await this.auditRecorder.record({
        action: 'finding.created',
        entityType: AuditEntityType.FINDING,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          orgUnitId: input.orgUnitId,
          title: input.title,
          description: input.description,
          recommendation: input.recommendation ?? null,
          category: input.category,
          origin: input.origin,
          severity: input.severity,
          priority: input.priority,
          ownerUserId: input.ownerUserId,
          identifiedOn,
          status: record.status,
          // T042/005-audit-findings (research.md D-9) — present (non-null)
          // only when this finding was produced by
          // `createFindingFromEngagement`; no new audit entity type for
          // this event, the same `finding.created` action the manual path
          // already uses.
          auditEngagementId: input.auditEngagementId ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    // Assurance fix — see this file's own header: existence and scope
    // failures are indistinguishable to the caller, both in status (422)
    // and in message (`orgUnitNotFound`), never `orgUnitOutOfScope`.
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive || !isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.findings.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.findings.orgUnitNotFound },
      ]);
    }
  }
}
