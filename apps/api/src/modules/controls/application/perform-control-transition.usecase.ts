import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerControlAuditAllowlists } from '../domain/control-audit-allowlist';
import {
  evaluateControlPreconditions,
  findControlLifecycleTransition,
} from '../domain/control-lifecycle';
import { isActiveForControlStatus } from '../domain/control.entity';
import { ControlLifecycleTransitionRepositoryPort } from '../domain/ports/control-lifecycle-transition-repository.port';
import { ControlReferenceDataPort } from '../domain/ports/control-reference-data.port';
import { ControlRepositoryPort } from '../domain/ports/control-repository.port';

import type { ControlLifecycleTransitionRecord } from '../domain/ports/control-lifecycle-transition-repository.port';
import type { ControlRecord } from '../domain/ports/control-repository.port';
import type { ControlStatus } from '@prisma/client';

const AUDIT_ACTION_BY_TARGET: Readonly<Partial<Record<ControlStatus, string>>> = {
  ACTIVE: 'control.activated',
  SUSPENDED: 'control.suspended',
  RETIRED: 'control.retired',
};

export interface PerformControlTransitionInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly expectedVersion: number;
  readonly toStatus: ControlStatus;
  readonly justification?: string | undefined;
}

export interface PerformControlTransitionResult {
  readonly transition: ControlLifecycleTransitionRecord;
  readonly control: ControlRecord;
}

@Injectable()
export class PerformControlTransitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlRepository: ControlRepositoryPort,
    private readonly transitionRepository: ControlLifecycleTransitionRepositoryPort,
    private readonly referenceData: ControlReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerControlAuditAllowlists();
  }

  async execute(input: PerformControlTransitionInput): Promise<PerformControlTransitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const referenceDate = new Date();

    const current = await this.controlRepository.findById(scope, input.controlId, referenceDate);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.entityLabel, input.controlId);
    }

    const rule = findControlLifecycleTransition(current.status, input.toStatus);
    if (!rule) {
      throw new ValidationDomainError(USER_MESSAGES.controls.lifecycle.transitionNotAllowed, [
        { field: 'toStatus', message: USER_MESSAGES.controls.lifecycle.transitionNotAllowed },
      ]);
    }

    const allowed = await this.permissionResolver.hasPermission(
      input.actorUserId,
      rule.requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenDomainError();
    }

    const preconditionResults = evaluateControlPreconditions(rule.preconditions, {
      ownerUserId: current.owner?.id,
      justification: input.justification,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      throw new ValidationDomainError(
        unmet[0]!.message,
        unmet.map((result) => ({ field: 'toStatus', message: result.message })),
      );
    }

    const justification = input.justification ?? null;
    const isActive = isActiveForControlStatus(input.toStatus);

    return this.transactionRunner.run(async () => {
      const transition = await this.transitionRepository.create({
        controlId: input.controlId,
        fromStatus: current.status,
        toStatus: input.toStatus,
        performedByUserId: input.actorUserId,
        justification,
      });

      const result = await this.controlRepository.applyLifecycleTransition(
        scope,
        input.controlId,
        input.expectedVersion,
        {
          status: input.toStatus,
          isActive,
          ...(!isActive
            ? {
                retiredAt: new Date(),
                retiredByUserId: input.actorUserId,
                retirementReason: justification!,
              }
            : {}),
        },
        referenceDate,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(USER_MESSAGES.controls.entityLabel, input.controlId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          USER_MESSAGES.controls.entityLabel,
          input.controlId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: AUDIT_ACTION_BY_TARGET[input.toStatus] ?? 'control.transitioned',
        entityType: AuditEntityType.CONTROL_LIFECYCLE_TRANSITION,
        entityId: transition.id,
        actorLabel: actor.fullName,
        newValues: {
          controlId: input.controlId,
          fromStatus: transition.fromStatus,
          toStatus: transition.toStatus,
          justification,
        },
        organizationalUnitId: result.record.orgUnit?.id,
      });

      return { transition, control: result.record };
    });
  }
}
