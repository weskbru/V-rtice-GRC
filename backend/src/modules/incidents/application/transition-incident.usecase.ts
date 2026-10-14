import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import {
  assertCancellationReasonProvided,
  assertLegalIncidentTransition,
  assertReopenReasonProvided,
  assertResolutionSummaryProvided,
  incidentTransitionEventName,
} from '../domain/incident.entity';
import { IncidentReferenceDataPort } from '../domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type {
  IncidentRecord,
  IncidentTransitionChanges,
} from '../domain/ports/incident-repository.port';
import type { IncidentStatus } from '@prisma/client';

export interface TransitionIncidentInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly toStatus: IncidentStatus;
  readonly resolutionSummary?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly reopenReason?: string | undefined;
}

@Injectable()
export class TransitionIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: TransitionIncidentInput): Promise<IncidentRecord> {
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

    assertLegalIncidentTransition(current.status, input.toStatus);

    const isReopen = input.toStatus === 'IN_PROGRESS' && current.status === 'RESOLVED';
    if (input.toStatus === 'RESOLVED') {
      assertResolutionSummaryProvided(input.resolutionSummary);
    }
    if (input.toStatus === 'CANCELLED') {
      assertCancellationReasonProvided(input.cancellationReason);
    }
    if (isReopen) {
      assertReopenReasonProvided(input.reopenReason);
    }

    const now = new Date();

    const changes: {
      -readonly [K in keyof IncidentTransitionChanges]: IncidentTransitionChanges[K];
    } = {
      status: input.toStatus,
      resolutionSummary: current.resolutionSummary ?? null,
      resolvedAt: current.resolvedAt ?? null,
      resolvedByUserId: current.resolvedBy?.id ?? null,
      closedAt: current.closedAt ?? null,
      closedByUserId: current.closedBy?.id ?? null,
      cancellationReason: current.cancellationReason ?? null,
      cancelledAt: current.cancelledAt ?? null,
      cancelledByUserId: current.cancelledBy?.id ?? null,
    };

    const previousValues: Record<string, unknown> = { status: current.status };
    const newValues: Record<string, unknown> = { status: input.toStatus };

    if (input.toStatus === 'RESOLVED') {
      changes.resolutionSummary = input.resolutionSummary!;
      changes.resolvedAt = now;
      changes.resolvedByUserId = input.actorUserId;
      newValues.resolutionSummary = changes.resolutionSummary;
      newValues.resolvedAt = changes.resolvedAt;
      newValues.resolvedByUserId = changes.resolvedByUserId;
    } else if (input.toStatus === 'CLOSED') {
      changes.closedAt = now;
      changes.closedByUserId = input.actorUserId;
      newValues.closedAt = changes.closedAt;
      newValues.closedByUserId = changes.closedByUserId;
    } else if (input.toStatus === 'CANCELLED') {
      changes.cancellationReason = input.cancellationReason!;
      changes.cancelledAt = now;
      changes.cancelledByUserId = input.actorUserId;
      newValues.cancellationReason = changes.cancellationReason;
      newValues.cancelledAt = changes.cancelledAt;
      newValues.cancelledByUserId = changes.cancelledByUserId;
    } else if (isReopen) {
      previousValues.resolutionSummary = current.resolutionSummary ?? null;
      previousValues.resolvedAt = current.resolvedAt ?? null;
      previousValues.resolvedByUserId = current.resolvedBy?.id ?? null;
      changes.resolutionSummary = null;
      changes.resolvedAt = null;
      changes.resolvedByUserId = null;
      newValues.resolutionSummary = null;
      newValues.resolvedAt = null;
      newValues.resolvedByUserId = null;
      newValues.reopenReason = input.reopenReason;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.incidentRepository.transition(scope, input.incidentId, changes);
      if (!updated) {
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

      await this.auditRecorder.record({
        action: incidentTransitionEventName(current.status, input.toStatus),
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
