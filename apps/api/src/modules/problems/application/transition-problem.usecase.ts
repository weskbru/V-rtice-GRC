import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ProblemReferenceDataPort } from '../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';
import {
  evaluateProblemPreconditions,
  findProblemLifecycleTransition,
} from '../domain/problem-lifecycle';
import {
  assertCloserNotSameAsCompleter,
  assertLegalProblemTransition,
  assertProblemHasCompletedCorrectiveAction,
  assertRootCauseProvided,
  assertCancellationReasonProvided,
  assertReopenReasonProvided,
} from '../domain/problem.entity';

import type {
  ApplyProblemTransitionChanges,
  ProblemRecord,
} from '../domain/ports/problem-repository.port';
import type { ProblemStatus } from '@prisma/client';

const AUDIT_ACTION_BY_TRANSITION: Readonly<Record<string, string>> = {
  'OPEN->IN_ANALYSIS': 'problem.analysis_started',
  'OPEN->CANCELLED': 'problem.cancelled',
  'IN_ANALYSIS->RESOLVED': 'problem.resolved',
  'IN_ANALYSIS->CANCELLED': 'problem.cancelled',
  'RESOLVED->CLOSED': 'problem.closed',
  'RESOLVED->IN_ANALYSIS': 'problem.reopened',
};

export interface TransitionProblemInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly toStatus: ProblemStatus;
  readonly rootCause?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly reopenReason?: string | undefined;
}

@Injectable()
export class TransitionProblemUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: TransitionProblemInput): Promise<ProblemRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.problemRepository.findById(scope, input.problemId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, input.problemId);
    }

    assertLegalProblemTransition(current.status, input.toStatus);
    const rule = findProblemLifecycleTransition(current.status, input.toStatus)!;

    const allowed = await this.permissionResolver.hasPermission(
      input.actorUserId,
      rule.requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenDomainError();
    }

    const preconditionResults = evaluateProblemPreconditions(rule.preconditions, {
      rootCause: input.rootCause,
      cancellationReason: input.cancellationReason,
      reopenReason: input.reopenReason,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      if (unmet.some((r) => r.id === 'HAS_ROOT_CAUSE')) assertRootCauseProvided(input.rootCause);
      if (unmet.some((r) => r.id === 'HAS_CANCELLATION_REASON'))
        assertCancellationReasonProvided(input.cancellationReason);
      if (unmet.some((r) => r.id === 'HAS_REOPEN_REASON'))
        assertReopenReasonProvided(input.reopenReason);
    }

    let completerUserIds: readonly string[] = [];
    if (input.toStatus === 'CLOSED') {
      completerUserIds = await this.problemRepository.findCompletedOriginActionCompleters(
        input.problemId,
      );
      assertProblemHasCompletedCorrectiveAction(completerUserIds);
      try {
        assertCloserNotSameAsCompleter(input.actorUserId, completerUserIds);
      } catch (error) {
        if (error instanceof ForbiddenDomainError) {
          await this.recordSegregationOfDutiesDenial(current, actor.fullName);
        }
        throw error;
      }
    }

    const referenceDate = new Date();
    const changes = this.buildTransitionChanges(input, referenceDate);

    return this.transactionRunner.run(async () => {
      const updated = await this.problemRepository.applyTransition(scope, input.problemId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, input.problemId);
      }

      const transitionKey = `${current.status}->${input.toStatus}`;
      await this.auditRecorder.record({
        action: AUDIT_ACTION_BY_TRANSITION[transitionKey] ?? 'problem.transitioned',
        entityType: AuditEntityType.PROBLEM,
        entityId: input.problemId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: {
          status: input.toStatus,
          rootCause: changes.rootCause,
          cancellationReason: changes.cancellationReason,
          reopenReason: input.reopenReason ?? undefined,
        },
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }

  private buildTransitionChanges(
    input: TransitionProblemInput,
    referenceDate: Date,
  ): ApplyProblemTransitionChanges {
    switch (input.toStatus) {
      case 'RESOLVED':
        return {
          status: 'RESOLVED',
          rootCause: input.rootCause!,
          resolvedAt: referenceDate,
          resolvedByUserId: input.actorUserId,
        };
      case 'CLOSED':
        return {
          status: 'CLOSED',
          closedAt: referenceDate,
          closedByUserId: input.actorUserId,
        };
      case 'CANCELLED':
        return {
          status: 'CANCELLED',
          cancellationReason: input.cancellationReason!,
          cancelledAt: referenceDate,
          cancelledByUserId: input.actorUserId,
        };
      case 'IN_ANALYSIS':
        return {
          status: 'IN_ANALYSIS',
          resolvedAt: null,
          resolvedByUserId: null,
        };
      default:
        return { status: input.toStatus };
    }
  }

  private async recordSegregationOfDutiesDenial(
    problem: ProblemRecord,
    actorLabel: string,
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'problem.close_denied',
        entityType: AuditEntityType.PROBLEM,
        entityId: problem.id,
        actorLabel,
        organizationalUnitId: problem.orgUnit.id,
        outcome: 'DENIED',
      });
    });
  }
}
