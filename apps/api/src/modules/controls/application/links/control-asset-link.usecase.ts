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
