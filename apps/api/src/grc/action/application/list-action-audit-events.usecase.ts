import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditQueryService } from '../../../core/audit/application/audit-query.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { AuditEventPage } from '../../../core/audit/domain/ports/audit-event-reader.port';

export interface ListActionAuditEventsInput {
  readonly actorUserId: string;
  readonly actionId: string;
  readonly action?: string | undefined;
  readonly actorUserIdFilter?: string | undefined;
  readonly occurredFrom?: Date | undefined;
  readonly occurredTo?: Date | undefined;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class ListActionAuditEventsUseCase {
  constructor(
    private readonly actionRepository: ActionRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditQueryService: AuditQueryService,
  ) {}

  async execute(input: ListActionAuditEventsInput): Promise<AuditEventPage> {
    const canViewAction = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'action:view',
    );
    const record = canViewAction
      ? await this.actionRepository.findByIdUnscoped(input.actionId)
      : undefined;
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      record.originType,
      record.originId,
    );

    const canViewAudit = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'audit:view',
    );
    if (!canViewAudit) {
      throw new ForbiddenDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    return this.auditQueryService.query({
      entityRefs: [{ entityType: AuditEntityType.ACTION, entityId: input.actionId }],
      action: input.action,
      actorUserId: input.actorUserIdFilter,
      occurredFrom: input.occurredFrom,
      occurredTo: input.occurredTo,
      scope,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
