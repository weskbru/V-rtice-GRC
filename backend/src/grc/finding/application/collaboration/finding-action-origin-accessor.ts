import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FindingRepositoryPort } from '../../domain/ports/finding-repository.port';
import { GetFindingUseCase } from '../get-finding.usecase';

import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../shared/domain/ports/action-origin-resolver.port';

@Injectable()
export class FindingActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly getFindingUseCase: GetFindingUseCase,
    private readonly permissionResolver: PermissionResolverService,
    private readonly findingRepository: FindingRepositoryPort,
  ) {}

  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveFinding(actorUserId, originId, 'finding:edit');
  }

  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveFinding(actorUserId, originId, 'finding:view');
  }

  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    const finding = await this.getFindingUseCase.execute({ actorUserId, findingId: originId });
    return {
      organizationalUnitId: finding.orgUnit.id,
      label: `${finding.code} — ${finding.title}`,
    };
  }

  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.findingRepository.listIdsInScope(scope);
  }

  private async resolveFinding(
    actorUserId: string,
    findingId: string,
    requiredPermission: 'finding:edit' | 'finding:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, findingId);
    }

    const finding = await this.getFindingUseCase.execute({ actorUserId, findingId });

    return {
      organizationalUnitId: finding.orgUnit.id,
      label: `${finding.code} — ${finding.title}`,
    };
  }
}
