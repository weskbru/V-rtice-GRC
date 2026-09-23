import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskCodeGeneratorPort } from '../domain/ports/risk-code-generator.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { RiskRecord } from '../domain/ports/risk-repository.port';

export interface CreateRiskInput {
  readonly actorUserId: string;
  readonly title: string;
  readonly description: string;
  readonly categoryId?: string | undefined;
  readonly typeId?: string | undefined;
  readonly originId?: string | undefined;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly responsibleUserId?: string | undefined;
  readonly identifiedOn?: string | undefined;
  readonly nextReviewOn?: string | undefined;
  readonly causes?: readonly string[] | undefined;
  readonly consequences?: readonly string[] | undefined;
}

@Injectable()
export class CreateRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly codeGenerator: RiskCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateRiskInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    await this.assertOrgUnitCreatable(scope, input.orgUnitId);
    const assignableUnitIds =
      (await this.assignmentLine.resolveUnitIds(input.orgUnitId)) ?? new Set<string>();

    await this.assertUserAssignable(
      input.ownerUserId,
      assignableUnitIds,
      input.orgUnitId,
      USER_MESSAGES.risk.ownerNotFound,
      USER_MESSAGES.risk.ownerNotAssignable,
      USER_MESSAGES.risk.ownerNotVisible,
      'ownerUserId',
    );
    if (input.responsibleUserId) {
      await this.assertUserAssignable(
        input.responsibleUserId,
        assignableUnitIds,
        input.orgUnitId,
        USER_MESSAGES.risk.responsibleNotFound,
        USER_MESSAGES.risk.responsibleNotAssignable,
        USER_MESSAGES.risk.responsibleNotVisible,
        'responsibleUserId',
      );
    }
    if (input.categoryId) {
      await this.assertReferenceActive(
        () => this.referenceData.findCategory(input.categoryId!),
        USER_MESSAGES.risk.categoryNotFound,
        'categoryId',
      );
    }
    if (input.typeId) {
      await this.assertReferenceActive(
        () => this.referenceData.findType(input.typeId!),
        USER_MESSAGES.risk.typeNotFound,
        'typeId',
      );
    }
    if (input.originId) {
      await this.assertReferenceActive(
        () => this.referenceData.findOrigin(input.originId!),
        USER_MESSAGES.risk.originNotFound,
        'originId',
      );
    }

    const identifiedOn = input.identifiedOn ? parseIsoDate(input.identifiedOn) : startOfTodayUtc();
    const nextReviewOn = input.nextReviewOn ? parseIsoDate(input.nextReviewOn) : undefined;
    const causes = input.causes ?? [];
    const consequences = input.consequences ?? [];
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode(codeYear);

      const record = await this.riskRepository.create({
        code,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        typeId: input.typeId,
        originId: input.originId,
        orgUnitId: input.orgUnitId,
        ownerUserId: input.ownerUserId,
        responsibleUserId: input.responsibleUserId,
        identifiedOn,
        nextReviewOn,
        causes,
        consequences,
      });

      await this.auditRecorder.record({
        action: 'risk.created',
        entityType: AuditEntityType.RISK,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          title: input.title,
          description: input.description,
          categoryId: input.categoryId ?? null,
          typeId: input.typeId ?? null,
          originId: input.originId ?? null,
          orgUnitId: input.orgUnitId,
          ownerUserId: input.ownerUserId,
          responsibleUserId: input.responsibleUserId ?? null,
          identifiedOn,
          nextReviewOn: nextReviewOn ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitNotFound },
      ]);
    }

    if (!isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.risk.orgUnitOutOfScope, [
        { field: 'orgUnitId', message: USER_MESSAGES.risk.orgUnitOutOfScope },
      ]);
    }
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

export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseIsoDate(value: string): Date {
  const datePart = value.length > 10 ? value.slice(0, 10) : value;
  return new Date(`${datePart}T00:00:00.000Z`);
}
