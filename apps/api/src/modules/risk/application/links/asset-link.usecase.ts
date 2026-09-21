/**
 * T142 — `LinkAssetUseCase`/`UnlinkAssetUseCase` (FR-053, FR-076, FR-025c,
 * FR-084, ADR-005, ADR-013, ADR-008). `POST`/`DELETE /risks/{riskId}/assets[/{linkId}]`
 * (`contracts/risks.openapi.yaml`'s `linkAssetToRisk`/`unlinkAssetFromRisk`).
 * Gated by `risk:edit`, not `risk:treat` — see `process-link.usecase.ts`,
 * which this mirrors exactly, replacing "process" with "asset".
 *
 * ## T034/006-assets-processes — "Vazamento 2" closed (ADR-020 parts 4/5)
 *
 * Until this fix, the referenced asset was resolved through
 * `AssetRegistryPort.findById` — a lookup that never carried `orgUnitId` at
 * all — so an actor scoped to unit A could link a risk in unit A to an
 * asset belonging to unit B: `GET /risks/{riskId}/assets` would then hand
 * that caller an out-of-scope asset's id, code and name, exactly the
 * disclosure ADR-020 part 4 exists to prevent, and exactly the gap F-46
 * closed for `LinkControlUseCase` (`control-link.usecase.ts`, same
 * directory) and left open here (spec §"Contexto medido").
 *
 * The fix mirrors `LinkControlUseCase` exactly: this file now resolves the
 * asset through `AssetDirectoryPort` (`shared/grc-ports/`, not
 * `AssetRegistryPort`, which never exposed scope and is left bound/unused
 * in `risk.module.ts` rather than deleted — a broader cleanup out of this
 * fix's own scope) and reuses the same `isOrgUnitWithinScope` predicate
 * every other cross-module link check in this codebase shares. An asset
 * with `orgUnitId === null` is visible only to a caller with `GLOBAL`
 * scope, matching `LinkControlUseCase`'s own null-handling. ADR-020 part
 * 5 — creating the link also now requires `asset:view` on the referenced
 * asset, not only `risk:edit`; both conditions are folded into the SAME
 * `ValidationDomainError`, never a branch that could disclose which one
 * failed.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import {
  ConflictDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { AssetDirectoryPort } from '../../../../shared/grc-ports/asset-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskAssetLinkRepositoryPort } from '../../domain/ports/risk-relationship-repository.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { LinkResult } from './control-link.usecase';
import type { EntityLinkRecord } from '../../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const LINK_ENTITY_LABEL = 'Vínculo com ativo';

export interface LinkAssetInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly assetId: string;
}

@Injectable()
export class LinkAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly assetLinkRepository: RiskAssetLinkRepositoryPort,
    private readonly assetDirectory: AssetDirectoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkAssetInput): Promise<LinkResult<EntityLinkRecord>> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the risk actually exists outside `scope`.
    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }
    assertBusinessContentEditable(currentRisk.status);

    // ADR-020 part 4 (FR-010, FR-011) - an asset outside the actor's
    // organizational scope answers exactly as a nonexistent one. ADR-020
    // part 5 - an asset that does not exist/is inactive and one the actor
    // lacks `asset:view` for answer with the exact same refusal: all
    // conditions are folded into ONE check, never branches that could
    // diverge in shape.
    const [asset, canViewAsset] = await Promise.all([
      this.assetDirectory.findById(input.assetId),
      this.permissionResolver.hasPermission(input.actorUserId, 'asset:view'),
    ]);
    // An asset with `orgUnitId === null` is visible only to a caller with
    // `GLOBAL` scope - matches `LinkControlUseCase`'s own null-handling
    // exactly.
    const assetOutOfScope = Boolean(
      asset &&
      (asset.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, asset.orgUnitId)),
    );
    if (!asset || !asset.isActive || assetOutOfScope || !canViewAsset) {
      throw new ValidationDomainError(USER_MESSAGES.risk.treatment.assetNotFound, [
        { field: 'id', message: USER_MESSAGES.risk.treatment.assetNotFound },
      ]);
    }

    const existing = await this.assetLinkRepository.findActiveLink(input.riskId, input.assetId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.risk.treatment.assetAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.assetLinkRepository.create(
        input.riskId,
        input.assetId,
        input.actorUserId,
      );

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );
      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: 'risk.asset_linked',
        entityType: AuditEntityType.RISK_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, assetId: input.assetId },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { link, risk: result.record };
    });
  }
}

export interface UnlinkAssetInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly linkId: string;
  readonly expectedVersion: number;
}

@Injectable()
export class UnlinkAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly assetLinkRepository: RiskAssetLinkRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkAssetInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the risk actually exists outside `scope`.
    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }
    assertBusinessContentEditable(currentRisk.status);

    const link = await this.assetLinkRepository.findById(input.riskId, input.linkId);
    if (link?.unlinkedAt !== null) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.assetLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );
      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: 'risk.asset_unlinked',
        entityType: AuditEntityType.RISK_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, assetId: link.entity.id, unlinkedAt },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
