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
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: CreateAuditEngagementInput): Promise<AuditEngagementRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
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

export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}
