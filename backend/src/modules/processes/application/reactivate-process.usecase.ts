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
import { ProcessReferenceDataPort } from '../domain/ports/process-reference-data.port';
import { ProcessRepositoryPort } from '../domain/ports/process-repository.port';

import type { ProcessRecord } from '../domain/ports/process-repository.port';

export interface ReactivateProcessInput {
  readonly actorUserId: string;
  readonly processId: string;
}

@Injectable()
export class ReactivateProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly processRepository: ProcessRepositoryPort,
    private readonly referenceData: ProcessReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ReactivateProcessInput): Promise<ProcessRecord> {
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

    if (current.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.processes.alreadyActive, [
        { field: 'isActive', message: USER_MESSAGES.processes.alreadyActive },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const reactivated = await this.processRepository.reactivate(scope, input.processId);
      if (!reactivated) {
        throw new NotFoundDomainError(USER_MESSAGES.processes.entityLabel, input.processId);
      }

      await this.auditRecorder.record({
        action: 'process.reactivated',
        entityType: AuditEntityType.PROCESS,
        entityId: input.processId,
        actorLabel: actor.fullName,
        previousValues: { isActive: false },
        newValues: { isActive: true },
        organizationalUnitId: reactivated.orgUnit?.id,
      });

      return reactivated;
    });
  }
}
