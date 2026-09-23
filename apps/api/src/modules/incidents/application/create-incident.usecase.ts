import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { parseIsoDate } from '../../../grc/shared/domain/iso-date';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { IncidentReferenceDataPort } from '../domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IncidentRecord } from '../domain/ports/incident-repository.port';
import type { IncidentSeverity } from '@prisma/client';

export interface CreateIncidentInput {
  readonly actorUserId: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly reportedOn: string;
  readonly ownerUserId?: string | undefined;
}

@Injectable()
export class CreateIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateIncidentInput): Promise<IncidentRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const ownerUserId = input.ownerUserId ?? input.actorUserId;
    const owner = await this.referenceData.findUser(ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.incidents.ownerNotFound },
      ]);
    }

    const reportedOn = parseIsoDate(input.reportedOn);
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('INC', codeYear);

      const record = await this.incidentRepository.create({
        code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        reportedByUserId: input.actorUserId,
        ownerUserId,
        reportedOn,
      });

      await this.auditRecorder.record({
        action: 'incident.created',
        entityType: AuditEntityType.INCIDENT,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          orgUnitId: input.orgUnitId,
          title: input.title,
          description: input.description,
          severity: input.severity,
          reportedByUserId: input.actorUserId,
          ownerUserId,
          reportedOn,
          status: record.status,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive || !isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.incidents.orgUnitNotFound },
      ]);
    }
  }
}
