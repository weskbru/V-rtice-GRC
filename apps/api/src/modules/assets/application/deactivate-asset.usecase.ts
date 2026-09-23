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

export interface DeactivateAssetInput {
  readonly actorUserId: string;
  readonly assetId: string;
}

@Injectable()
export class DeactivateAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly assetRepository: AssetRepositoryPort,
    private readonly referenceData: AssetReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: DeactivateAssetInput): Promise<AssetRecord> {
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

    if (!current.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.assets.alreadyInactive, [
        { field: 'isActive', message: USER_MESSAGES.assets.alreadyInactive },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const deactivated = await this.assetRepository.deactivate(scope, input.assetId);
      if (!deactivated) {
        throw new NotFoundDomainError(USER_MESSAGES.assets.entityLabel, input.assetId);
      }

      await this.auditRecorder.record({
        action: 'asset.deactivated',
        entityType: AuditEntityType.ASSET,
        entityId: input.assetId,
        actorLabel: actor.fullName,
        previousValues: { isActive: true },
        newValues: { isActive: false },
        organizationalUnitId: deactivated.orgUnit?.id,
      });

      return deactivated;
    });
  }
}
