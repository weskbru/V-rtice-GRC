/**
 * 008-incidents-problems, US3 — `LinkIncidentRiskUseCase`/
 * `UnlinkIncidentRiskUseCase`/`ListIncidentRiskLinksUseCase`. Mirrors
 * `grc/finding/application/links/link-finding-risk.usecase.ts` exactly —
 * see that file's header for the full ADR-020 five-part account this one
 * does not repeat.
 *
 * The one structural difference: `modules/incidents` has no full
 * `IncidentRepositoryPort` yet (the incident lifecycle is a concurrent,
 * separate workstream — data-model.md §1). The SOURCE-side existence+scope
 * check below therefore goes through `IncidentDirectoryPort.findById`
 * instead of a scoped repository lookup, exactly the read
 * `IncidentActionOriginAccessor.resolveScopedLookup`
 * (`application/incident-action-origin-accessor.ts`) already performs for
 * the identical reason — `IncidentDirectoryPort.findById` is inherently
 * UNSCOPED (it returns the entry regardless of the caller's scope), so it
 * doubles as the "resolve actual org unit" callback
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` (F-38) needs,
 * with no separate unscoped lookup method required.
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
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { IncidentDirectoryPort } from '../../../../shared/grc-ports/incident-directory.port';
import { RiskDirectoryPort } from '../../../../shared/grc-ports/risk-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { IncidentReferenceDataPort } from '../../domain/ports/incident-reference-data.port';
import { IncidentRiskLinkRepositoryPort } from '../../domain/ports/incident-risk-link-repository.port';

import { resolveInScopeIncident } from './resolve-in-scope-incident';

import type { IncidentRiskLinkRecord } from '../../domain/incident-risk-link.entity';

export interface LinkIncidentRiskInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly riskId: string;
}

@Injectable()
export class LinkIncidentRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentRiskLinkRepositoryPort,
    private readonly riskDirectory: RiskDirectoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkIncidentRiskInput): Promise<IncidentRiskLinkRecord> {
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

    // ADR-020 parts 4+5 — checked BEFORE any write; a missing, archived,
    // out-of-scope risk and a risk the actor lacks `risk:view` for all
    // answer with the exact same refusal.
    const [risk, canViewRisk] = await Promise.all([
      this.riskDirectory.findById(input.riskId),
      this.permissionResolver.hasPermission(input.actorUserId, 'risk:view'),
    ]);
    const riskOutOfScope = Boolean(risk && !isOrgUnitWithinScope(scope, risk.orgUnitId));
    if (!risk || !risk.isActive || riskOutOfScope || !canViewRisk) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.riskNotFound, [
        { field: 'riskId', message: USER_MESSAGES.incidents.link.riskNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.incidentId, input.riskId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.incidents.link.riskAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.incidentId,
        input.riskId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'incident_risk_link.linked',
        entityType: AuditEntityType.INCIDENT_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, riskId: input.riskId },
        organizationalUnitId: incident.orgUnitId,
      });

      return link;
    });
  }
}

export interface UnlinkIncidentRiskInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly linkId: string;
}

/** ADR-020 part 5 deliberately NOT extended here — same exemption
 * `UnlinkFindingRiskUseCase` documents for its own unlink path. */
@Injectable()
export class UnlinkIncidentRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentRiskLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkIncidentRiskInput): Promise<IncidentRiskLinkRecord> {
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
      throw new NotFoundDomainError(USER_MESSAGES.incidents.riskLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.incidents.link.riskLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.incidents.link.riskLinkAlreadyWithdrawn },
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
        action: 'incident_risk_link.unlinked',
        entityType: AuditEntityType.INCIDENT_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { incidentId: input.incidentId, riskId: link.risk.id, unlinkedAt },
        organizationalUnitId: incident.orgUnitId,
      });

      return unlinked;
    });
  }
}

export interface ListIncidentRiskLinksInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListIncidentRiskLinksUseCase {
  constructor(
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly linkRepository: IncidentRiskLinkRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListIncidentRiskLinksInput): Promise<readonly IncidentRiskLinkRecord[]> {
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
