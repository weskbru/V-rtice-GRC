import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import { isOrgUnitWithinScope, parseIsoDate } from './create-risk.usecase';

import type { UpdateRiskChanges, RiskRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export interface UpdateRiskInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly categoryId?: string | null | undefined;
  readonly typeId?: string | null | undefined;
  readonly originId?: string | null | undefined;
  readonly orgUnitId?: string | undefined;
  readonly ownerUserId?: string | undefined;
  readonly responsibleUserId?: string | null | undefined;
  readonly identifiedOn?: string | undefined;
  readonly nextReviewOn?: string | null | undefined;
}

@Injectable()
export class UpdateRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateRiskInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }

    assertBusinessContentEditable(current.status);

    const changes: { -readonly [K in keyof UpdateRiskChanges]: UpdateRiskChanges[K] } = {};
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

    if (input.categoryId !== undefined) {
      const currentCategoryId = current.category?.id ?? null;
      if (input.categoryId !== currentCategoryId) {
        if (input.categoryId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findCategory(input.categoryId!),
            USER_MESSAGES.risk.categoryNotFound,
            'categoryId',
          );
        }
        changes.categoryId = input.categoryId;
        previousValues.categoryId = currentCategoryId;
        newValues.categoryId = input.categoryId;
      }
    }

    if (input.typeId !== undefined) {
      const currentTypeId = current.type?.id ?? null;
      if (input.typeId !== currentTypeId) {
        if (input.typeId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findType(input.typeId!),
            USER_MESSAGES.risk.typeNotFound,
            'typeId',
          );
        }
        changes.typeId = input.typeId;
        previousValues.typeId = currentTypeId;
        newValues.typeId = input.typeId;
      }
    }

    if (input.originId !== undefined) {
      const currentOriginId = current.origin?.id ?? null;
      if (input.originId !== currentOriginId) {
        if (input.originId !== null) {
          await this.assertReferenceActive(
            () => this.referenceData.findOrigin(input.originId!),
            USER_MESSAGES.risk.originNotFound,
            'originId',
          );
        }
        changes.originId = input.originId;
        previousValues.originId = currentOriginId;
        newValues.originId = input.originId;
      }
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit.id) {
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitNotFound, [
          { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitNotFound },
        ]);
      }
      if (!isOrgUnitWithinScope(scope, input.orgUnitId)) {
        throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitOutOfScope, [
          { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitOutOfScope },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit.id;
      newValues.orgUnitId = input.orgUnitId;
    }

    const finalOrgUnitId = changes.orgUnitId ?? current.orgUnit.id;
    const orgUnitChanging = changes.orgUnitId !== undefined;
    let assignableUnitIds: ReadonlySet<string> | undefined;
    const resolveAssignableUnitIds = async (): Promise<ReadonlySet<string>> => {
      assignableUnitIds ??=
        (await this.assignmentLine.resolveUnitIds(finalOrgUnitId)) ?? new Set<string>();
      return assignableUnitIds;
    };

    const ownerChanging = input.ownerUserId !== undefined && input.ownerUserId !== current.owner.id;
    if (ownerChanging || orgUnitChanging) {
      const resultingOwnerUserId = input.ownerUserId ?? current.owner.id;
      await this.assertUserAssignable(
        resultingOwnerUserId,
        await resolveAssignableUnitIds(),
        finalOrgUnitId,
        USER_MESSAGES.risk.ownerNotFound,
        USER_MESSAGES.risk.ownerNotAssignable,
        USER_MESSAGES.risk.ownerNotVisible,
        'ownerUserId',
      );
    }
    if (ownerChanging) {
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.owner.id;
      newValues.ownerUserId = input.ownerUserId;
    }

    if (input.responsibleUserId !== undefined) {
      const currentResponsibleId = current.responsible?.id ?? null;
      if (input.responsibleUserId !== currentResponsibleId) {
        if (input.responsibleUserId !== null) {
          await this.assertUserAssignable(
            input.responsibleUserId,
            await resolveAssignableUnitIds(),
            finalOrgUnitId,
            USER_MESSAGES.risk.responsibleNotFound,
            USER_MESSAGES.risk.responsibleNotAssignable,
            USER_MESSAGES.risk.responsibleNotVisible,
            'responsibleUserId',
          );
        }
        changes.responsibleUserId = input.responsibleUserId;
        previousValues.responsibleUserId = currentResponsibleId;
        newValues.responsibleUserId = input.responsibleUserId;
      }
    } else if (orgUnitChanging && current.responsible) {
      await this.assertUserAssignable(
        current.responsible.id,
        await resolveAssignableUnitIds(),
        finalOrgUnitId,
        USER_MESSAGES.risk.responsibleNotFound,
        USER_MESSAGES.risk.responsibleNotAssignable,
        USER_MESSAGES.risk.responsibleNotVisible,
        'responsibleUserId',
      );
    }

    if (input.identifiedOn !== undefined) {
      const parsed = parseIsoDate(input.identifiedOn);
      if (parsed.getTime() !== current.identifiedOn.getTime()) {
        changes.identifiedOn = parsed;
        previousValues.identifiedOn = current.identifiedOn;
        newValues.identifiedOn = parsed;
      }
    }

    if (input.nextReviewOn !== undefined) {
      const parsed = input.nextReviewOn === null ? null : parseIsoDate(input.nextReviewOn);
      const currentTime = current.nextReviewOn?.getTime();
      const parsedTime = parsed?.getTime();
      if (parsedTime !== currentTime) {
        changes.nextReviewOn = parsed;
        previousValues.nextReviewOn = current.nextReviewOn ?? null;
        newValues.nextReviewOn = parsed;
      }
    }

    return this.transactionRunner.run(async () => {
      const result = await this.riskRepository.updateWithVersion(
        scope,
        input.riskId,
        input.expectedVersion,
        changes,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      if (Object.keys(newValues).length > 0) {
        await this.auditRecorder.record({
          action: 'risk.updated',
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          actorLabel: actor.fullName,
          previousValues,
          newValues,
          organizationalUnitId: result.record.orgUnit.id,
        });
      }

      return result.record;
    });
  }

  private async assertUserAssignable(
    userId: string,
    assignmentLine: ReadonlySet<string>,
    orgUnitId: string,
    notFoundMessage: string,
    notAssignableMessage: string,
    notVisibleMessage: string,
    field: string,
  ): Promise<void> {
    const user = await this.referenceData.findUser(userId);
    if (!user?.isActive) {
      throw new ValidationDomainError(notFoundMessage, [{ field, message: notFoundMessage }]);
    }
    if (user.primaryOrgUnitId !== undefined && !assignmentLine.has(user.primaryOrgUnitId)) {
      throw new ValidationDomainError(notAssignableMessage, [
        { field, message: notAssignableMessage },
      ]);
    }

    const [canViewRisks, candidateScope] = await Promise.all([
      this.permissionResolver.hasPermission(userId, 'risk:view'),
      this.scopeResolver.resolveScope(userId),
    ]);
    if (!canViewRisks || !this.assignmentLine.isQuestionInScope(candidateScope, orgUnitId)) {
      throw new ValidationDomainError(notVisibleMessage, [{ field, message: notVisibleMessage }]);
    }
  }

  private async assertReferenceActive(
    lookup: () => Promise<{ isActive: boolean } | undefined>,
    message: string,
    field: string,
  ): Promise<void> {
    const reference = await lookup();
    if (!reference?.isActive) {
      throw new ValidationDomainError(message, [{ field, message }]);
    }
  }
}
