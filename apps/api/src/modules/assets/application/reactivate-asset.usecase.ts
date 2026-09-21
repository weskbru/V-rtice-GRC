/**
 * T021/006-assets-processes — `ReactivateAssetUseCase` (`POST
 * /assets/{assetId}/reactivate`, `reactivateAsset` operation, FR-005). The
 * mirror transition of `DeactivateAssetUseCase` — see that file's header
 * for the shared reasoning. Refused with `422` if the asset is already
 * active, and nothing changes.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AssetReferenceDataPort } from '../domain/ports/asset-reference-data.port';
import { AssetRepositoryPort } from '../domain/ports/asset-repository.port';

import type { AssetRecord } from '../domain/ports/asset-repository.port';

export interface ReactivateAssetInput {
  readonly actorUserId: string;
  readonly assetId: string;
}

@Injectable()
export class ReactivateAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly assetRepository: AssetRepositoryPort,
    private readonly referenceData: AssetReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ReactivateAssetInput): Promise<AssetRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.assetRepository.findById(scope, input.assetId);
    if (!current) {
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

    if (current.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.assets.alreadyActive, [
        { field: 'isActive', message: USER_MESSAGES.assets.alreadyActive },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const reactivated = await this.assetRepository.reactivate(scope, input.assetId);
      if (!reactivated) {
        throw new NotFoundDomainError(USER_MESSAGES.assets.entityLabel, input.assetId);
      }

      await this.auditRecorder.record({
        action: 'asset.reactivated',
        entityType: AuditEntityType.ASSET,
        entityId: input.assetId,
        actorLabel: actor.fullName,
        previousValues: { isActive: false },
        newValues: { isActive: true },
        organizationalUnitId: reactivated.orgUnit?.id,
      });

      return reactivated;
    });
  }
}
