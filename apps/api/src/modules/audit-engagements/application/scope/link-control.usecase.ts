import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ConflictDomainError, ValidationDomainError } from '../../../../shared/errors/domain-error';
import { ControlDirectoryPort } from '../../../../shared/grc-ports/control-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerAuditEngagementAuditAllowlists } from '../../domain/audit-engagement-audit-allowlist';
import { assertAuditEngagementEditable } from '../../domain/audit-engagement.entity';
import { AuditScopeRepositoryPort } from '../../domain/ports/audit-scope-repository.port';
import { AuditEngagementAccessResolver } from '../audit-engagement-access-resolver.service';

import type { AuditScopeLinkResult } from './link-framework-version.usecase';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface LinkAuditScopeToControlInput {
  readonly actorUserId: string;
  readonly auditEngagementId: string;
  readonly controlId: string;
}

function isControlWithinScope(
  scope: ScopeFilter,
  control: { readonly orgUnitId: string | null },
): boolean {
  if (scope.kind === 'GLOBAL') {
    return true;
  }
  return control.orgUnitId !== null && scope.unitIds.has(control.orgUnitId);
}

@Injectable()
export class LinkAuditScopeToControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly accessResolver: AuditEngagementAccessResolver,
    private readonly scopeRepository: AuditScopeRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerAuditEngagementAuditAllowlists();
  }

  async execute(input: LinkAuditScopeToControlInput): Promise<AuditScopeLinkResult> {
    const actor = await this.accessResolver.resolveActor(input.actorUserId);
    const { scope, auditEngagement } = await this.accessResolver.resolveAuditEngagement(
      input.actorUserId,
      input.auditEngagementId,
    );

    assertAuditEngagementEditable(auditEngagement.status);

    const [control, canView] = await Promise.all([
      this.controlDirectory.findById(input.controlId),
      this.permissionResolver.hasPermission(input.actorUserId, 'control:view'),
    ]);
    if (!control || !control.isActive || !isControlWithinScope(scope, control) || !canView) {
      throw new ValidationDomainError(USER_MESSAGES.auditEngagements.scope.controlNotFound, [
        { field: 'controlId', message: USER_MESSAGES.auditEngagements.scope.controlNotFound },
      ]);
    }

    const existing = await this.scopeRepository.hasControlLink(
      input.auditEngagementId,
      input.controlId,
    );
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.auditEngagements.scope.controlAlreadyInScope);
    }

    const linkedAt = new Date();

    return this.transactionRunner.run(async () => {
      const link = await this.scopeRepository.createControlLink(
        input.auditEngagementId,
        input.controlId,
        input.actorUserId,
        linkedAt,
      );

      await this.auditRecorder.record({
        action: 'audit_scope_control.linked',
        entityType: AuditEntityType.AUDIT_SCOPE_CONTROL,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { auditEngagementId: input.auditEngagementId, controlId: input.controlId },
        organizationalUnitId: auditEngagement.orgUnit.id,
      });

      return link;
    });
  }
}
