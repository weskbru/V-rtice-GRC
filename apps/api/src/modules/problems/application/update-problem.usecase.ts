import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ProblemReferenceDataPort } from '../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';

import type { ProblemRecord, UpdateProblemChanges } from '../domain/ports/problem-repository.port';
import type { ProblemSeverity } from '@prisma/client';

export interface UpdateProblemInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly severity?: ProblemSeverity | undefined;
  readonly ownerUserId?: string | undefined;
}

@Injectable()
export class UpdateProblemUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateProblemInput): Promise<ProblemRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.problemRepository.findById(scope, input.problemId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          entityLabel: USER_MESSAGES.problems.entityLabel,
        },
        () => this.problemRepository.findOrgUnitIdUnscoped(input.problemId),
      );
    }

    const changes: { -readonly [K in keyof UpdateProblemChanges]: UpdateProblemChanges[K] } = {};
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
      const assignableUnitIds =
        (await this.assignmentLine.resolveUnitIds(current.orgUnit.id)) ?? new Set<string>();
      await this.assertOwnerAssignable(input.ownerUserId, assignableUnitIds);
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.owner.id;
      newValues.ownerUserId = input.ownerUserId;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.problemRepository.update(scope, input.problemId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, input.problemId);
      }

      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'problem.updated',
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
          organizationalUnitId: updated.orgUnit.id,
        });
      }

      return updated;
    });
  }

  private async assertOwnerAssignable(
    ownerUserId: string,
    assignmentLine: ReadonlySet<string>,
  ): Promise<void> {
    const owner = await this.referenceData.findUser(ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.problems.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.problems.ownerNotFound },
      ]);
    }
    if (owner.primaryOrgUnitId !== undefined && !assignmentLine.has(owner.primaryOrgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.problems.ownerNotAssignable, [
        { field: 'ownerUserId', message: USER_MESSAGES.problems.ownerNotAssignable },
      ]);
    }
  }
}
