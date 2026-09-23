import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { AssetRepositoryPort } from '../domain/ports/asset-repository.port';

import type { AssetRecord } from '../domain/ports/asset-repository.port';

export interface GetAssetInput {
  readonly actorUserId: string;
  readonly assetId: string;
}

@Injectable()
export class GetAssetUseCase {
  constructor(
    private readonly assetRepository: AssetRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: GetAssetInput): Promise<AssetRecord> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const record = await this.assetRepository.findById(scope, input.assetId);
    if (!record) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.ASSET,
          entityId: input.assetId,
          entityLabel: USER_MESSAGES.assets.entityLabel,
        },
        () => this.assetRepository.findOrgUnitIdUnscoped(input.assetId),
      );
    }

    return record;
  }
}
