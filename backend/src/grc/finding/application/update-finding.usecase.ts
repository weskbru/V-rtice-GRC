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
import { assertFindingEditable } from '../domain/finding.entity';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord, UpdateFindingChanges } from '../domain/ports/finding-repository.port';
import type { FindingCategory, FindingPriority, FindingSeverity } from '@prisma/client';

export interface UpdateFindingInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly recommendation?: string | null | undefined;
  readonly category?: FindingCategory | undefined;
  readonly severity?: FindingSeverity | undefined;
  readonly priority?: FindingPriority | undefined;
  readonly ownerUserId?: string | undefined;
}

@Injectable()
export class UpdateFindingUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateFindingInput): Promise<FindingRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
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

    assertFindingEditable(current.status);

    const changes: { -readonly [K in keyof UpdateFindingChanges]: UpdateFindingChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    let priorityChanged = false;

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

    if (
      input.recommendation !== undefined &&
      input.recommendation !== (current.recommendation ?? null)
    ) {
      changes.recommendation = input.recommendation;
      previousValues.recommendation = current.recommendation ?? null;
      newValues.recommendation = input.recommendation;
    }

    if (input.category !== undefined && input.category !== current.category) {
      changes.category = input.category;
      previousValues.category = current.category;
      newValues.category = input.category;
    }

    if (input.severity !== undefined && input.severity !== current.severity) {
      changes.severity = input.severity;
      previousValues.severity = current.severity;
      newValues.severity = input.severity;
    }

    if (input.priority !== undefined && input.priority !== current.priority) {
      changes.priority = input.priority;
      previousValues.priority = current.priority;
      newValues.priority = input.priority;
      priorityChanged = true;
    }

    if (input.ownerUserId !== undefined && input.ownerUserId !== current.owner.id) {
      const owner = await this.referenceData.findUser(input.ownerUserId);
      if (!owner?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.findings.ownerNotFound, [
          { field: 'ownerUserId', message: USER_MESSAGES.findings.ownerNotFound },
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
      const updated = await this.findingRepository.update(scope, input.findingId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, input.findingId);
      }

      if (priorityChanged) {
        await this.auditRecorder.record({
          action: 'finding.priority_changed',
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          actorLabel: actor.fullName,
          previousValues: { priority: previousValues.priority },
          newValues: { priority: newValues.priority },
          organizationalUnitId: current.orgUnit.id,
        });
      }

      const { priority: _priorityPrev, ...otherPreviousValues } = previousValues;
      const { priority: _priorityNew, ...otherNewValues } = newValues;
      if (Object.keys(otherNewValues).length > 0) {
        await this.auditRecorder.record({
          action: 'finding.updated',
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          actorLabel: actor.fullName,
          previousValues: otherPreviousValues,
          newValues: otherNewValues,
          organizationalUnitId: current.orgUnit.id,
        });
      }

      return updated;
    });
  }
}
