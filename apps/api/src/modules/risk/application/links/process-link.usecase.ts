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
import { ProcessDirectoryPort } from '../../../../shared/grc-ports/process-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskProcessLinkRepositoryPort } from '../../domain/ports/risk-relationship-repository.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { LinkResult } from './control-link.usecase';
import type { EntityLinkRecord } from '../../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const LINK_ENTITY_LABEL = 'Vínculo com processo';

export interface LinkProcessInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly processId: string;
}

@Injectable()
export class LinkProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly processLinkRepository: RiskProcessLinkRepositoryPort,
    private readonly processDirectory: ProcessDirectoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkProcessInput): Promise<LinkResult<EntityLinkRecord>> {
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

    const [process, canViewProcess] = await Promise.all([
      this.processDirectory.findById(input.processId),
      this.permissionResolver.hasPermission(input.actorUserId, 'process:view'),
    ]);
    const processOutOfScope = Boolean(
      process &&
      (process.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, process.orgUnitId)),
    );
    if (!process || !process.isActive || processOutOfScope || !canViewProcess) {
      throw new ValidationDomainError(USER_MESSAGES.risk.treatment.processNotFound, [
        { field: 'id', message: USER_MESSAGES.risk.treatment.processNotFound },
      ]);
    }

    const existing = await this.processLinkRepository.findActiveLink(input.riskId, input.processId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.risk.treatment.processAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.processLinkRepository.create(
        input.riskId,
        input.processId,
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
        action: 'risk.process_linked',
        entityType: AuditEntityType.RISK_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, processId: input.processId },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { link, risk: result.record };
    });
  }
}

export interface UnlinkProcessInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly linkId: string;
  readonly expectedVersion: number;
}

@Injectable()
export class UnlinkProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly processLinkRepository: RiskProcessLinkRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkProcessInput): Promise<RiskRecord> {
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

    const link = await this.processLinkRepository.findById(input.riskId, input.linkId);
    if (link?.unlinkedAt !== null) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.processLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

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
        action: 'risk.process_unlinked',
        entityType: AuditEntityType.RISK_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, processId: link.entity.id, unlinkedAt },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
