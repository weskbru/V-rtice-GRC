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
          auditEngagementId: input.auditEngagementId ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive || !isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.findings.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.findings.orgUnitNotFound },
      ]);
    }
  }
}
