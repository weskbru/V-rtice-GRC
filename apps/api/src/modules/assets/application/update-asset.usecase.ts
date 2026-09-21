/**
 * T020/006-assets-processes — `UpdateAssetUseCase`: field-by-field update
 * with per-field audit (`PATCH /assets/{assetId}`, `updateAsset`
 * operation, FR-003). Mirrors
 * `grc/finding/application/update-finding.usecase.ts`'s structure — no
 * optimistic-lock version (`assets` carries no `version` column,
 * data-model.md §1/contract's own description — see
 * `contracts/assets.openapi.yaml`'s header for why no `If-Match` applies
 * here).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { assertAssetNameProvided } from '../domain/asset.entity';
import { AssetReferenceDataPort } from '../domain/ports/asset-reference-data.port';
import { AssetRepositoryPort } from '../domain/ports/asset-repository.port';

import type { AssetRecord, UpdateAssetChanges } from '../domain/ports/asset-repository.port';

export interface UpdateAssetInput {
  readonly actorUserId: string;
  readonly assetId: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

@Injectable()
export class UpdateAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly assetRepository: AssetRepositoryPort,
    private readonly referenceData: AssetReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateAssetInput): Promise<AssetRecord> {
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

    const changes: { -readonly [K in keyof UpdateAssetChanges]: UpdateAssetChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== current.name) {
      assertAssetNameProvided(input.name);
      changes.name = input.name;
      previousValues.name = current.name;
      newValues.name = input.name;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description ?? null;
      newValues.description = input.description;
    }

    if (input.orgUnitId !== undefined && input.orgUnitId !== current.orgUnit?.id) {
      const orgUnit = await this.referenceData.findOrgUnit(input.orgUnitId);
      const isUsable = Boolean(orgUnit?.isActive) && isOrgUnitWithinScope(scope, input.orgUnitId);
      if (!isUsable) {
        throw new ValidationDomainError(USER_MESSAGES.assets.orgUnitRequired, [
          { field: 'orgUnitId', message: USER_MESSAGES.assets.orgUnitRequired },
        ]);
      }
      changes.orgUnitId = input.orgUnitId;
      previousValues.orgUnitId = current.orgUnit?.id ?? null;
      newValues.orgUnitId = input.orgUnitId;
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.assetRepository.update(scope, input.assetId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.assets.entityLabel, input.assetId);
      }

      await this.auditRecorder.record({
        action: 'asset.updated',
        entityType: AuditEntityType.ASSET,
        entityId: input.assetId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: updated.orgUnit?.id,
      });

      return updated;
    });
  }
}
