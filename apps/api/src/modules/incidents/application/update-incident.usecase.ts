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
import { IncidentReferenceDataPort } from '../domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type {
  IncidentRecord,
  UpdateIncidentChanges,
} from '../domain/ports/incident-repository.port';
import type { IncidentSeverity } from '@prisma/client';

export interface UpdateIncidentInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly severity?: IncidentSeverity | undefined;
  readonly ownerUserId?: string | undefined;
}

@Injectable()
export class UpdateIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateIncidentInput): Promise<IncidentRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const current = await this.incidentRepository.findById(scope, input.incidentId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.INCIDENT,
          entityId: input.incidentId,
          entityLabel: USER_MESSAGES.incidents.entityLabel,
        },
        () => this.incidentRepository.findOrgUnitIdUnscoped(input.incidentId),
      );
    }

    const changes: { -readonly [K in keyof UpdateIncidentChanges]: UpdateIncidentChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title;
      previousValues.title = current.title;
      newValues.title = input.title;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }

    if (input.severity !== undefined && input.severity !== current.severity) {
      changes.severity = input.severity;
      previousValues.severity = current.severity;
      newValues.severity = input.severity;
    }

    if (input.ownerUserId !== undefined && input.ownerUserId !== current.owner.id) {
      const owner = await this.referenceData.findUser(input.ownerUserId);
      if (!owner?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.incidents.ownerNotFound, [
          { field: 'ownerUserId', message: USER_MESSAGES.incidents.ownerNotFound },
        ]);
      }
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.owner.id;
      newValues.ownerUserId = input.ownerUserId;
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.incidentRepository.update(scope, input.incidentId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.incidents.entityLabel, input.incidentId);
      }

      await this.auditRecorder.record({
        action: 'incident.updated',
        entityType: AuditEntityType.INCIDENT,
        entityId: input.incidentId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }
}
