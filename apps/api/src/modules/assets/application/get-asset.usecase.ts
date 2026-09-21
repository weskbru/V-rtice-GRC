/**
 * T018/006-assets-processes — `GetAssetUseCase`: the read side of `GET
 * /assets/{assetId}` (`getAsset` operation, FR-008). Mirrors
 * `grc/finding/application/get-finding.usecase.ts` exactly — no
 * transaction, no audit entry (a read is never audited, ADR-005); a scope
 * denial IS recorded, via `OrgScopeEnforcerService
 * .assertExistingRecordAccessible` (F-38's mechanism), whenever the asset
 * genuinely exists outside the caller's scope (FR-016).
 *
 * The returned `AssetRecord` already carries `risks`/`controls`
 * (`AssetRepositoryPort.findById`'s own contract) — this use case does not
 * read any link table itself.
 */
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

    // FR-010: an asset outside scope reads as `undefined`, mapped to the
    // same 404 as "does not exist" — never surfaced to the caller.
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
