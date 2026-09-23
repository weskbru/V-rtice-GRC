import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

@Injectable()
export class ControlAssessmentActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'control:edit');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'control:view');
  }

  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.assessmentRepository.listAssessmentIdsInScope(scope);
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'control:edit' | 'control:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }
    return this.resolveScopedLookup(actorUserId, originId);
  }

  private async resolveScopedLookup(
    actorUserId: string,
    originId: string,
  ): Promise<ActionOriginAccess> {
    const lookup = await this.assessmentRepository.findForOrigin(originId);
    if (!lookup) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }

    const scope = await this.scopeResolver.resolveScope(actorUserId);
    if (!isOrgUnitWithinScope(scope, lookup.controlOrgUnitId)) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }

    return {
      organizationalUnitId: lookup.controlOrgUnitId,
      label: `${lookup.controlCode} — verificação de ${lookup.assessedOn.toISOString().slice(0, 10)}`,
    };
  }
}
