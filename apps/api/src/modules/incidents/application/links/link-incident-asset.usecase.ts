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
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { AssetDirectoryPort } from '../../../../shared/grc-ports/asset-directory.port';
import { IncidentDirectoryPort } from '../../../../shared/grc-ports/incident-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { IncidentAssetLinkRepositoryPort } from '../../domain/ports/incident-asset-link-repository.port';
import { IncidentReferenceDataPort } from '../../domain/ports/incident-reference-data.port';

import { resolveInScopeIncident } from './resolve-in-scope-incident';

import type { IncidentAssetLinkRecord } from '../../domain/incident-asset-link.entity';

export interface LinkIncidentAssetInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly assetId: string;
}

@Injectable()
export class LinkIncidentAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentAssetLinkRepositoryPort,
    private readonly assetDirectory: AssetDirectoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkIncidentAssetInput): Promise<IncidentAssetLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const incident = await resolveInScopeIncident(
      this.incidentDirectory,
      this.scopeEnforcer,
      scope,
      input.actorUserId,
      input.incidentId,
    );

    const [asset, canViewAsset] = await Promise.all([
      this.assetDirectory.findById(input.assetId),
      this.permissionResolver.hasPermission(input.actorUserId, 'asset:view'),
    ]);
    const assetOutOfScope = asset
      ? asset.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, asset.orgUnitId)
      : false;
    if (!asset || !asset.isActive || assetOutOfScope || !canViewAsset) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.assetNotFound, [
        { field: 'assetId', message: USER_MESSAGES.incidents.link.assetNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.incidentId, input.assetId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.incidents.link.assetAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.incidentId,
        input.assetId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'incident_asset_link.linked',
        entityType: AuditEntityType.INCIDENT_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, assetId: input.assetId },
        organizationalUnitId: incident.orgUnitId,
      });

      return link;
    });
  }
}

export interface UnlinkIncidentAssetInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkIncidentAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentAssetLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkIncidentAssetInput): Promise<IncidentAssetLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const incident = await resolveInScopeIncident(
      this.incidentDirectory,
      this.scopeEnforcer,
      scope,
      input.actorUserId,
      input.incidentId,
    );

    const link = await this.linkRepository.findById(input.incidentId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(USER_MESSAGES.incidents.assetLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.assetLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.incidents.link.assetLinkAlreadyWithdrawn },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      const unlinked = await this.linkRepository.unlink(
        input.linkId,
        input.actorUserId,
        unlinkedAt,
      );

      await this.auditRecorder.record({
        action: 'incident_asset_link.unlinked',
        entityType: AuditEntityType.INCIDENT_ASSET_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, assetId: link.asset.id, unlinkedAt },
        organizationalUnitId: incident.orgUnitId,
      });

      return unlinked;
    });
  }
}

export interface ListIncidentAssetLinksInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListIncidentAssetLinksUseCase {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentAssetLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListIncidentAssetLinksInput): Promise<readonly IncidentAssetLinkRecord[]> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await resolveInScopeIncident(
      this.incidentDirectory,
      this.scopeEnforcer,
      scope,
      input.actorUserId,
      input.incidentId,
    );

    return this.linkRepository.listByIncident(input.incidentId, input.includeWithdrawn);
  }
}
