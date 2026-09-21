/**
 * T020/006-assets-processes — `UpdateProcessUseCase`: identical in shape to
 * `modules/assets/application/update-asset.usecase.ts` (FR-020).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ProcessReferenceDataPort } from '../domain/ports/process-reference-data.port';
import { ProcessRepositoryPort } from '../domain/ports/process-repository.port';
import { assertProcessNameProvided } from '../domain/process.entity';

import type { ProcessRecord, UpdateProcessChanges } from '../domain/ports/process-repository.port';

export interface UpdateProcessInput {
  readonly actorUserId: string;
  readonly processId: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

@Injectable()
export class UpdateProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly processRepository: ProcessRepositoryPort,
    private readonly referenceData: ProcessReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateProcessInput): Promise<ProcessRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.processRepository.findById(scope, input.processId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROCESS,
          entityId: input.processId,
          entityLabel: USER_MESSAGES.processes.entityLabel,
        },
        () => this.processRepository.findOrgUnitIdUnscoped(input.processId),
      );
    }

    const changes: { -readonly [K in keyof UpdateProcessChanges]: UpdateProcessChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== current.name) {
      assertProcessNameProvided(input.name);
      changes.name = input.name;
      previousValues.name = current.name;
      newValues.name = input.name;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description ?? null;
      newValues.description = input.description;
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit?.id) {
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      const isUsable = Boolean(orgUnit?.isActive) && isOrgUnitWithinScope(scope, input.orgUnitId);
      if (!isUsable) {
        throw new ValidationDomainError(USER_MESSAGES.processes.orgUnitRequired, [
          { field: 'orgUnitId', message: USER_MESSAGES.processes.orgUnitRequired },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit?.id ?? null;
      newValues.orgUnitId = input.orgUnitId;
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.processRepository.update(scope, input.processId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.processes.entityLabel, input.processId);
      }

      await this.auditRecorder.record({
        action: 'process.updated',
        entityType: AuditEntityType.PROCESS,
        entityId: input.processId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: updated.orgUnit?.id,
      });

      return updated;
    });
  }
}
