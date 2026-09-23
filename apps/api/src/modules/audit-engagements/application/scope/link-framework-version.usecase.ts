import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ConflictDomainError, ValidationDomainError } from '../../../../shared/errors/domain-error';
import { FrameworkVersionDirectoryPort } from '../../../../shared/grc-ports/framework-version-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../../domain/audit-engagement-audit-allowlist';
import { assertAuditEngagementEditable } from '../../domain/audit-engagement.entity';
import { AuditScopeRepositoryPort } from '../../domain/ports/audit-scope-repository.port';
import { AuditEngagementAccessResolver } from '../audit-engagement-access-resolver.service';

export interface LinkAuditScopeToFrameworkVersionInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly frameworkVersionId: string;
}

export interface AuditScopeLinkResult {
  readonly id: string;
  readonly linkedAt: Date;
}

@Injectable()
export class LinkAuditScopeToFrameworkVersionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly scopeRepository: AuditScopeRepositoryPort,
    private readonly frameworkVersionDirectory: FrameworkVersionDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: LinkAuditScopeToFrameworkVersionInput): Promise<AuditScopeLinkResult> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    assertAuditEngagementEditable(auditEngagement.status);

    const [frameworkVersion, canView] = await Promise.all([
      this.frameworkVersionDirectory.findById(input.frameworkVersionId),
      this.permissionResolver.hasPermission(input.actorUserId, 'compliance:view'),
    ]);
    if (frameworkVersion?.status !== 'PUBLISHED' || !canView) {
      throw new ValidationDomainError(
        USER_MESSAGES.auditEngagements.scope.frameworkVersionNotFound,
        [
          {
            field: 'frameworkVersionId',
            message: USER_MESSAGES.auditEngagements.scope.frameworkVersionNotFound,
          },
        ],
      );
    }

    const existing = await this.scopeRepository.hasFrameworkVersionLink(
      input.auditEngagementId,
      input.frameworkVersionId,
    );
    if (existing) {
      throw new ConflictDomainError(
        USER_MESSAGES.auditEngagements.scope.frameworkVersionAlreadyInScope,
      );
    }

    const linkedAt = new Date();

    return this.transactionRunner.run(async () => {
      const link = await this.scopeRepository.createFrameworkVersionLink(
        input.auditEngagementId,
        input.frameworkVersionId,
        input.actorUserId,
        linkedAt,
      );

      await this.auditRecorder.record({
        action: 'audit_scope_framework_version.linked',
        entityType: AuditEntityType.AUDIT_SCOPE_FRAMEWORK_VERSION,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          auditEngagementId: input.auditEngagementId,
          frameworkVersionId: input.frameworkVersionId,
        },
        organizationalUnitId: auditEngagement.orgUnit.id,
      });

      return link;
    });
  }
}
