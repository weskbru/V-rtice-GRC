import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { RiskDirectoryPort } from '../../../../shared/grc-ports/risk-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { isOrgUnitWithinScope } from '../../../shared/domain/org-scope';
import { assertFindingEditable } from '../../domain/finding.entity';
import { FindingReferenceDataPort } from '../../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../../domain/ports/finding-repository.port';
import { FindingRiskLinkRepositoryPort } from '../../domain/ports/finding-risk-link-repository.port';

import type { FindingRiskLinkRecord } from '../../domain/finding-risk-link.entity';

export interface LinkFindingRiskInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly riskId: string;
}

@Injectable()
export class LinkFindingRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingRiskLinkRepositoryPort,
    private readonly riskDirectory: RiskDirectoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkFindingRiskInput): Promise<FindingRiskLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
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
    assertFindingEditable(finding.status);

    const [risk, canViewRisk] = await Promise.all([
      this.riskDirectory.findById(input.riskId),
      this.permissionResolver.hasPermission(input.actorUserId, 'risk:view'),
    ]);
    const riskOutOfScope = Boolean(risk && !isOrgUnitWithinScope(scope, risk.orgUnitId));
    if (!risk || !risk.isActive || riskOutOfScope || !canViewRisk) {
      throw new ValidationDomainError(USER_MESSAGES.findings.link.riskNotFound, [
        { field: 'riskId', message: USER_MESSAGES.findings.link.riskNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.findingId, input.riskId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.findings.link.riskAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.findingId,
        input.riskId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'finding_risk_link.linked',
        entityType: AuditEntityType.FINDING_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { findingId: input.findingId, riskId: input.riskId },
        organizationalUnitId: finding.orgUnit.id,
      });

      return link;
    });
  }
}

export interface UnlinkFindingRiskInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkFindingRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingRiskLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkFindingRiskInput): Promise<FindingRiskLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
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
    assertFindingEditable(finding.status);

    const link = await this.linkRepository.findById(input.findingId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(USER_MESSAGES.findings.riskLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.findings.link.riskLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.findings.link.riskLinkAlreadyWithdrawn },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      const unlinked = await this.linkRepository.unlink(
        input.linkId,
        input.actorUserId,
        unlinkedAt,
      );

      await this.auditRecorder.record({
        action: 'finding_risk_link.unlinked',
        entityType: AuditEntityType.FINDING_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { findingId: input.findingId, riskId: link.risk.id, unlinkedAt },
        organizationalUnitId: finding.orgUnit.id,
      });

      return unlinked;
    });
  }
}

export interface ListFindingRiskLinksInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListFindingRiskLinksUseCase {
  constructor(
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingRiskLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListFindingRiskLinksInput): Promise<readonly FindingRiskLinkRecord[]> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
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

    return this.linkRepository.listByFinding(input.findingId, input.includeWithdrawn);
  }
}
