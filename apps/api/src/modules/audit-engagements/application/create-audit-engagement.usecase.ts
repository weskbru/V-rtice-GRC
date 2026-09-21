/**
 * T025/005-audit-findings, User Story 1 — `CreateAuditEngagementUseCase`
 * (`POST /audits`, `createAuditEngagement` operation, FR-001, US1 AS1).
 * Mirrors `modules/controls/application/create-control.usecase.ts`'s
 * structure — see that file's header for the transaction-boundary/order-
 * of-checks reasoning this one does not repeat.
 *
 * ## Code generation reuses the GRC kernel's shared allocator
 *
 * `EntityCodeGeneratorPort.nextCode('AUD', year)` — the SAME allocator
 * (`GrcCodeSequence`) `Control`/`Framework` already extended, now
 * extended once more with the `AUD` prefix (T006, research.md D-8). Never
 * a second, duplicated counter mechanism in this module.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../domain/audit-engagement-audit-allowlist';
import { assertPeriodEndNotBeforeStart } from '../domain/audit-engagement.entity';
import { AuditEngagementReferenceDataPort } from '../domain/ports/audit-engagement-reference-data.port';
import { AuditEngagementRepositoryPort } from '../domain/ports/audit-engagement-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AuditEngagementRecord } from '../domain/ports/audit-engagement-repository.port';

export interface CreateAuditEngagementInput {
  readonly actorUserId: string;
  readonly objective: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly orgUnitId: string;
  readonly leadAuditorUserId: string;
}

@Injectable()
export class CreateAuditEngagementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditEngagementRepository: AuditEngagementRepositoryPort,
    private readonly referenceData: AuditEngagementReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    // Idempotent — see that function's own doc comment.
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: CreateAuditEngagementInput): Promise<AuditEngagementRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      // Defensive only: `SessionGuard` already proved this user has a live
      // session, so the actor row existing is expected. Fails closed
      // rather than attributing an audit event to a fabricated label.
      throw new UnauthorizedDomainError();
    }

    assertPeriodEndNotBeforeStart(input.periodStart, input.periodEnd);

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);
    await this.assertLeadAuditorAssignable(input.leadAuditorUserId);

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('AUD', codeYear);

      const record = await this.auditEngagementRepository.create({
        code,
        objective: input.objective,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        orgUnitId: input.orgUnitId,
        leadAuditorUserId: input.leadAuditorUserId,
      });

      await this.auditRecorder.record({
        action: 'audit_engagement.created',
        entityType: AuditEntityType.AUDIT_ENGAGEMENT,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          objective: input.objective,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          orgUnitId: input.orgUnitId,
          leadAuditorUserId: input.leadAuditorUserId,
          status: record.status,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.auditEngagements.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.auditEngagements.orgUnitNotFound },
      ]);
    }
    if (!isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.auditEngagements.orgUnitOutOfScope, [
        { field: 'orgUnitId', message: USER_MESSAGES.auditEngagements.orgUnitOutOfScope },
      ]);
    }
  }

  private async assertLeadAuditorAssignable(leadAuditorUserId: string): Promise<void> {
    const leadAuditor = await this.referenceData.findUser(leadAuditorUserId);
    if (!leadAuditor?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.auditEngagements.leadAuditorNotFound, [
        { field: 'leadAuditorUserId', message: USER_MESSAGES.auditEngagements.leadAuditorNotFound },
      ]);
    }
  }
}

/** Mirrors `create-control.usecase.ts`'s own exported
 * `isOrgUnitWithinScope`, kept as a local, module-private copy rather than
 * cross-module import (`grc/shared/domain/org-scope.ts`'s own copy exists
 * for `grc/**` capabilities; this module is a business module, and
 * duplicating this four-line predicate is cheaper than adding a cross-
 * cutting dependency for it — the same call `create-control.usecase.ts`
 * itself makes rather than importing Risk's copy). */
export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}
