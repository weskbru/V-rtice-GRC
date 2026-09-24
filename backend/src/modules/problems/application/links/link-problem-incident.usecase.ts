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
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { ProblemIncidentLinkRepositoryPort } from '../../domain/ports/problem-incident-link-repository.port';
import { ProblemReferenceDataPort } from '../../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../../domain/ports/problem-repository.port';

import type { ProblemIncidentLinkRecord } from '../../domain/problem-incident-link.entity';

export interface LinkProblemIncidentInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly incidentId: string;
}

@Injectable()
export class LinkProblemIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemIncidentLinkRepositoryPort,
    private readonly incidentDirectory: IncidentDirectoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkProblemIncidentInput): Promise<ProblemIncidentLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const problem = await this.problemRepository.findById(scope, input.problemId);
    if (!problem) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          entityLabel: USER_MESSAGES.problems.entityLabel,
        },
        () => this.problemRepository.findOrgUnitIdUnscoped(input.problemId),
      );
    }

    const [incident, canViewIncident] = await Promise.all([
      this.incidentDirectory.findById(input.incidentId),
      this.permissionResolver.hasPermission(input.actorUserId, 'incident:view'),
    ]);
    const incidentOutOfScope = Boolean(
      incident && !isOrgUnitWithinScope(scope, incident.orgUnitId),
    );
    if (!incident || incidentOutOfScope || !canViewIncident) {
      throw new ValidationDomainError(USER_MESSAGES.problems.link.incidentNotFound, [
        { field: 'incidentId', message: USER_MESSAGES.problems.link.incidentNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.problemId, input.incidentId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.problems.link.incidentAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.problemId,
        input.incidentId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'problem_incident_link.linked',
        entityType: AuditEntityType.PROBLEM_INCIDENT_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { problemId: input.problemId, incidentId: input.incidentId },
        organizationalUnitId: problem.orgUnit.id,
      });

      return link;
    });
  }
}

export interface UnlinkProblemIncidentInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkProblemIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemIncidentLinkRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkProblemIncidentInput): Promise<ProblemIncidentLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const problem = await this.problemRepository.findById(scope, input.problemId);
    if (!problem) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          entityLabel: USER_MESSAGES.problems.entityLabel,
        },
        () => this.problemRepository.findOrgUnitIdUnscoped(input.problemId),
      );
    }

    const link = await this.linkRepository.findById(input.problemId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.incidentLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.problems.link.incidentLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.problems.link.incidentLinkAlreadyWithdrawn },
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
        action: 'problem_incident_link.unlinked',
        entityType: AuditEntityType.PROBLEM_INCIDENT_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { problemId: input.problemId, incidentId: link.incident.id, unlinkedAt },
        organizationalUnitId: problem.orgUnit.id,
      });

      return unlinked;
    });
  }
}

export interface ListProblemIncidentLinksInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListProblemIncidentLinksUseCase {
  constructor(
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemIncidentLinkRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(
    input: ListProblemIncidentLinksInput,
  ): Promise<readonly ProblemIncidentLinkRecord[]> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const problem = await this.problemRepository.findById(scope, input.problemId);
    if (!problem) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.PROBLEM,
          entityId: input.problemId,
          entityLabel: USER_MESSAGES.problems.entityLabel,
        },
        () => this.problemRepository.findOrgUnitIdUnscoped(input.problemId),
      );
    }

    return this.linkRepository.listByProblem(input.problemId, input.includeWithdrawn);
  }
}
