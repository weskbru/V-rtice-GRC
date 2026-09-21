/**
 * T037/003-controls-management, User Story 3 — `LinkControlToAssetUseCase`/
 * `UnlinkControlFromAssetUseCase`. Same shape and rationale as
 * `control-process-link.usecase.ts` above, against `Asset` instead of
 * `Process` — see that file's header for the full ADR-020 part 4
 * "checked before the write" account this file mirrors exactly.
 *
 * ## T036/006-assets-processes — `AssetDirectoryPort`, not
 * `AssetRegistryLookupPort`/`reference-registry-lookup.repository.ts`
 *
 * `Asset` is now a business-module domain owned by `modules/assets`
 * (data-model.md §8, Constitution Principle I) — `modules/controls` may no
 * longer read `prisma.client.asset` itself, directly or through a lookup
 * port that does. This file now depends on the shared boundary port
 * (`shared/grc-ports/asset-directory.port.ts`) that `modules/assets`
 * provides, the same shape `control-link.usecase.ts`
 * (`modules/risk`) already uses for `Control`. The null-handling changes
 * with it: `AssetDirectoryEntry.orgUnitId` is `string | null` (never
 * `undefined`) — a caller with `GLOBAL` scope may still see a `null`-unit
 * asset, mirroring `LinkControlUseCase`'s own `orgUnitId === null` branch
 * exactly (that file's own header explains why `isOrgUnitWithinScope`
 * itself must not be called with `null`).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { AssetDirectoryPort } from '../../../../shared/grc-ports/asset-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { assertControlAcceptsNewLink } from '../../domain/control-relationship.entity';
import { ControlAssetLinkRepositoryPort } from '../../domain/ports/control-relationship-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlEntityLinkRecord } from '../../domain/ports/control-relationship-repository.port';

const LINK_ENTITY_LABEL = 'Vínculo com ativo';

export interface LinkControlToAssetInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly assetId: string;
}

@Injectable()
export class LinkControlToAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly assetLinkRepository: ControlAssetLinkRepositoryPort,
    private readonly assetDirectory: AssetDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: LinkControlToAssetInput): Promise<ControlEntityLinkRecord> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { scope, control } = await this.controlAccess.resolveControl(
      input.actorUserId,
      input.controlId,
    );

    assertControlAcceptsNewLink(control.status);

    // ADR-020 part 4 — checked BEFORE any write; a missing, inactive or
    // out-of-scope asset answers exactly as nonexistent. An asset with
    // `orgUnitId === null` is visible only to a caller with `GLOBAL` scope
    // — mirrors `LinkControlUseCase`'s own null-handling exactly
    // (`modules/risk/application/links/control-link.usecase.ts`).
    //
    // ADR-020 part 5 (006-assets-processes, FR-011) — `asset:view` on the
    // REFERENCED side, added the same change that added it to
    // `modules/risk`'s own Risco→Ativo pair. It was briefly deferred here on
    // the reasoning that this pair "already had part 4", which is exactly
    // the reasoning F-46 used when it closed Risco→Controle and left
    // Risco→Ativo and Risco→Processo open — two siblings fixed, two left,
    // in the same directory, on the same day. `data-model.md` §10 lists
    // `control:edit` + `asset:view` for this pair explicitly, flagging the
    // second as missing, so the deferral also contradicted this feature's
    // own design. Folded into the SAME single refusal below, never a
    // separate branch that could diverge in shape.
    const [asset, canViewAsset] = await Promise.all([
      this.assetDirectory.findById(input.assetId),
      this.permissionResolver.hasPermission(input.actorUserId, 'asset:view'),
    ]);
    const assetOutOfScope = Boolean(
      asset &&
      (asset.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, asset.orgUnitId)),
    );
    if (!asset || !asset.isActive || assetOutOfScope || !canViewAsset) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assetEntityLabel, input.assetId);
    }

    const existing = await this.assetLinkRepository.findActiveLink(input.controlId, input.assetId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.controls.relationships.assetAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.assetLinkRepository.create(
        input.controlId,
        input.assetId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'control.asset_linked',
        entityType: AuditEntityType.CONTROL_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { controlId: input.controlId, assetId: input.assetId },
        organizationalUnitId: control.orgUnitId,
      });

      return link;
    });
  }
}

export interface UnlinkControlFromAssetInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkControlFromAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly assetLinkRepository: ControlAssetLinkRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UnlinkControlFromAssetInput): Promise<void> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { control } = await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

    const link = await this.assetLinkRepository.findById(input.controlId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.controls.relationships.linkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.controls.relationships.linkAlreadyWithdrawn },
      ]);
    }

    await this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.assetLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      await this.auditRecorder.record({
        action: 'control.asset_unlinked',
        entityType: AuditEntityType.CONTROL_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { controlId: input.controlId, assetId: link.entity.id, unlinkedAt },
        organizationalUnitId: control.orgUnitId,
      });
    });
  }
}
