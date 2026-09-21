/**
 * T029/005-audit-findings, User Story 1 — `LinkAuditScopeToRequirementUseCase`
 * (`POST /audits/{auditId}/scope/requirements`, `addRequirementToScope`
 * operation). Same shape as `LinkAuditScopeToFrameworkVersionUseCase` —
 * see that file's header for the ADR-020 parts 4/5 reasoning this one does
 * not repeat — checked against the requirement's OWN parent version's
 * `PUBLISHED` status (`RequirementDirectoryEntry.frameworkVersionStatus`,
 * transitively, research.md D-2/D-11), never a second round trip through
 * `FrameworkVersionDirectoryPort`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ConflictDomainError, ValidationDomainError } from '../../../../shared/errors/domain-error';
import { RequirementDirectoryPort } from '../../../../shared/grc-ports/requirement-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../../domain/audit-engagement-audit-allowlist';
import { assertAuditEngagementEditable } from '../../domain/audit-engagement.entity';
import { AuditScopeRepositoryPort } from '../../domain/ports/audit-scope-repository.port';
import { AuditEngagementAccessResolver } from '../audit-engagement-access-resolver.service';

import type { AuditScopeLinkResult } from './link-framework-version.usecase';

export interface LinkAuditScopeToRequirementInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly requirementId: string;
}

@Injectable()
export class LinkAuditScopeToRequirementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly scopeRepository: AuditScopeRepositoryPort,
    private readonly requirementDirectory: RequirementDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: LinkAuditScopeToRequirementInput): Promise<AuditScopeLinkResult> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    assertAuditEngagementEditable(auditEngagement.status);

    const [requirement, canView] = await Promise.all([
      this.requirementDirectory.findById(input.requirementId),
      this.permissionResolver.hasPermission(input.actorUserId, 'compliance:view'),
    ]);
    if (requirement?.frameworkVersionStatus !== 'PUBLISHED' || !canView) {
      throw new ValidationDomainError(USER_MESSAGES.auditEngagements.scope.requirementNotFound, [
        {
          field: 'requirementId',
          message: USER_MESSAGES.auditEngagements.scope.requirementNotFound,
        },
      ]);
    }

    const existing = await this.scopeRepository.hasRequirementLink(
      input.auditEngagementId,
      input.requirementId,
    );
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.auditEngagements.scope.requirementAlreadyInScope);
    }

    const linkedAt = new Date();

    return this.transactionRunner.run(async () => {
      const link = await this.scopeRepository.createRequirementLink(
        input.auditEngagementId,
        input.requirementId,
        input.actorUserId,
        linkedAt,
      );

      await this.auditRecorder.record({
        action: 'audit_scope_requirement.linked',
        entityType: AuditEntityType.AUDIT_SCOPE_REQUIREMENT,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          auditEngagementId: input.auditEngagementId,
          requirementId: input.requirementId,
        },
        organizationalUnitId: auditEngagement.orgUnit.id,
      });

      return link;
    });
  }
}
