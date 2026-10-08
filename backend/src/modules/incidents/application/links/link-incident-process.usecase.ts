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
import { IncidentDirectoryPort } from '../../../../shared/grc-ports/incident-directory.port';
import { ProcessDirectoryPort } from '../../../../shared/grc-ports/process-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { IncidentProcessLinkRepositoryPort } from '../../domain/ports/incident-process-link-repository.port';
import { IncidentReferenceDataPort } from '../../domain/ports/incident-reference-data.port';

import { resolveInScopeIncident } from './resolve-in-scope-incident';

import type { IncidentProcessLinkRecord } from '../../domain/incident-process-link.entity';

export interface LinkIncidentProcessInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly processId: string;
}

@Injectable()
export class LinkIncidentProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentProcessLinkRepositoryPort,
    private readonly processDirectory: ProcessDirectoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkIncidentProcessInput): Promise<IncidentProcessLinkRecord> {
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

    const [process, canViewProcess] = await Promise.all([
      this.processDirectory.findById(input.processId),
      this.permissionResolver.hasPermission(input.actorUserId, 'process:view'),
    ]);
    const processOutOfScope = process
      ? process.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, process.orgUnitId)
      : false;
    if (!process || !process.isActive || processOutOfScope || !canViewProcess) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.processNotFound, [
        { field: 'processId', message: USER_MESSAGES.incidents.link.processNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.incidentId, input.processId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.incidents.link.processAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.incidentId,
        input.processId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'incident_process_link.linked',
        entityType: AuditEntityType.INCIDENT_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, processId: input.processId },
        organizationalUnitId: incident.orgUnitId,
      });

      return link;
    });
  }
}

export interface UnlinkIncidentProcessInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkIncidentProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentProcessLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkIncidentProcessInput): Promise<IncidentProcessLinkRecord> {
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
      throw new NotFoundDomainError(USER_MESSAGES.incidents.processLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.processLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.incidents.link.processLinkAlreadyWithdrawn },
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
        action: 'incident_process_link.unlinked',
        entityType: AuditEntityType.INCIDENT_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, processId: link.process.id, unlinkedAt },
        organizationalUnitId: incident.orgUnitId,
      });

      return unlinked;
    });
  }
}

export interface ListIncidentProcessLinksInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListIncidentProcessLinksUseCase {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentProcessLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(
    input: ListIncidentProcessLinksInput,
  ): Promise<readonly IncidentProcessLinkRecord[]> {
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
