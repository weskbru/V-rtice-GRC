import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import {
  ConflictDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { ControlDirectoryPort } from '../../../../shared/grc-ports/control-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskControlLinkRepositoryPort } from '../../domain/ports/risk-relationship-repository.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { ControlLinkRecord } from '../../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const LINK_ENTITY_LABEL = 'Vínculo com controle';

export interface LinkControlInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly controlId: string;
}

export interface LinkResult<TLink> {
  readonly link: TLink;
  readonly risk: RiskRecord;
}

@Injectable()
export class LinkControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkControlInput): Promise<LinkResult<ControlLinkRecord>> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
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
    assertBusinessContentEditable(currentRisk.status);

    const [control, canViewControl] = await Promise.all([
      this.controlDirectory.findById(input.controlId),
      this.permissionResolver.hasPermission(input.actorUserId, 'control:view'),
    ]);
    const controlOutOfScope = Boolean(
      control &&
      (control.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, control.orgUnitId)),
    );
    if (!control || !control.isActive || controlOutOfScope || !canViewControl) {
      throw new ValidationDomainError(USER_MESSAGES.risk.treatment.controlNotFound, [
        { field: 'id', message: USER_MESSAGES.risk.treatment.controlNotFound },
      ]);
    }

    const existing = await this.controlLinkRepository.findActiveLink(input.riskId, input.controlId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.risk.treatment.controlAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.controlLinkRepository.create(
        input.riskId,
        input.controlId,
        input.actorUserId,
      );

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
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

      await this.auditRecorder.record({
        action: 'risk.control_linked',
        entityType: AuditEntityType.RISK_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, controlId: input.controlId },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { link, risk: result.record };
    });
  }
}

export interface UnlinkControlInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly linkId: string;
  readonly expectedVersion: number;
}

@Injectable()
export class UnlinkControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkControlInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
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
    assertBusinessContentEditable(currentRisk.status);

    const link = await this.controlLinkRepository.findById(input.riskId, input.linkId);
    if (link?.unlinkedAt !== null) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.controlLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
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

      await this.auditRecorder.record({
        action: 'risk.control_unlinked',
        entityType: AuditEntityType.RISK_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, controlId: link.control.id, unlinkedAt },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
