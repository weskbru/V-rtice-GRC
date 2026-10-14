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
import { ControlDirectoryPort } from '../../../../shared/grc-ports/control-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { isOrgUnitWithinScope } from '../../../shared/domain/org-scope';
import { assertFindingEditable } from '../../domain/finding.entity';
import { FindingControlLinkRepositoryPort } from '../../domain/ports/finding-control-link-repository.port';
import { FindingReferenceDataPort } from '../../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../../domain/ports/finding-repository.port';

import type { FindingControlLinkRecord } from '../../domain/finding-control-link.entity';

export interface LinkFindingControlInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly controlId: string;
}

@Injectable()
export class LinkFindingControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkFindingControlInput): Promise<FindingControlLinkRecord> {
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
      throw new ValidationDomainError(USER_MESSAGES.findings.link.controlNotFound, [
        { field: 'controlId', message: USER_MESSAGES.findings.link.controlNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.findingId, input.controlId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.findings.link.controlAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.findingId,
        input.controlId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'finding_control_link.linked',
        entityType: AuditEntityType.FINDING_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { findingId: input.findingId, controlId: input.controlId },
        organizationalUnitId: finding.orgUnit.id,
      });

      return link;
    });
  }
}

export interface UnlinkFindingControlInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkFindingControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkFindingControlInput): Promise<FindingControlLinkRecord> {
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
      throw new NotFoundDomainError(USER_MESSAGES.findings.controlLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.findings.link.controlLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.findings.link.controlLinkAlreadyWithdrawn },
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
        action: 'finding_control_link.unlinked',
        entityType: AuditEntityType.FINDING_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          findingId: input.findingId,
          controlId: link.control.id,
          unlinkedAt,
        },
        organizationalUnitId: finding.orgUnit.id,
      });

      return unlinked;
    });
  }
}

export interface ListFindingControlLinksInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListFindingControlLinksUseCase {
  constructor(
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListFindingControlLinksInput): Promise<readonly FindingControlLinkRecord[]> {
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
