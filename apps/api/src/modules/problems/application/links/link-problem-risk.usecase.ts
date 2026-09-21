/**
 * 008-incidents-problems, US3 — `LinkProblemRiskUseCase`/
 * `UnlinkProblemRiskUseCase`/`ListProblemRiskLinksUseCase`. Mirrors
 * `grc/finding/application/links/link-finding-risk.usecase.ts` exactly —
 * see that file's header for the full ADR-020 five-part account this one
 * does not repeat.
 *
 * Unlike `modules/incidents`'s own link use cases (built before a full
 * `IncidentRepositoryPort` existed), `ProblemRepositoryPort` already
 * exposes the exact scoped/unscoped pair `LinkFindingRiskUseCase` itself
 * uses (`findById(scope, id)` / `findOrgUnitIdUnscoped(id)`), so the
 * SOURCE-side check here goes through `OrgScopeEnforcerService
 * .assertExistingRecordAccessible` directly, the same F-38 shape.
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
import { RiskDirectoryPort } from '../../../../shared/grc-ports/risk-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { ProblemReferenceDataPort } from '../../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../../domain/ports/problem-repository.port';
import { ProblemRiskLinkRepositoryPort } from '../../domain/ports/problem-risk-link-repository.port';

import type { ProblemRiskLinkRecord } from '../../domain/problem-risk-link.entity';

export interface LinkProblemRiskInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly riskId: string;
}

@Injectable()
export class LinkProblemRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemRiskLinkRepositoryPort,
    private readonly riskDirectory: RiskDirectoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkProblemRiskInput): Promise<ProblemRiskLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the problem actually exists outside `scope`.
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

    // ADR-020 parts 4+5 — checked BEFORE any write; a missing, archived,
    // out-of-scope risk and a risk the actor lacks `risk:view` for all
    // answer with the exact same refusal.
    const [risk, canViewRisk] = await Promise.all([
      this.riskDirectory.findById(input.riskId),
      this.permissionResolver.hasPermission(input.actorUserId, 'risk:view'),
    ]);
    const riskOutOfScope = Boolean(risk && !isOrgUnitWithinScope(scope, risk.orgUnitId));
    if (!risk || !risk.isActive || riskOutOfScope || !canViewRisk) {
      throw new ValidationDomainError(USER_MESSAGES.problems.link.riskNotFound, [
        { field: 'riskId', message: USER_MESSAGES.problems.link.riskNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.problemId, input.riskId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.problems.link.riskAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.problemId,
        input.riskId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'problem_risk_link.linked',
        entityType: AuditEntityType.PROBLEM_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { problemId: input.problemId, riskId: input.riskId },
        organizationalUnitId: problem.orgUnit.id,
      });

      return link;
    });
  }
}

export interface UnlinkProblemRiskInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkProblemRiskUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemRiskLinkRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkProblemRiskInput): Promise<ProblemRiskLinkRecord> {
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
      throw new NotFoundDomainError(USER_MESSAGES.problems.riskLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.problems.link.riskLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.problems.link.riskLinkAlreadyWithdrawn },
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
        action: 'problem_risk_link.unlinked',
        entityType: AuditEntityType.PROBLEM_RISK_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { problemId: input.problemId, riskId: link.risk.id, unlinkedAt },
        organizationalUnitId: problem.orgUnit.id,
      });

      return unlinked;
    });
  }
}

export interface ListProblemRiskLinksInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListProblemRiskLinksUseCase {
  constructor(
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly linkRepository: ProblemRiskLinkRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListProblemRiskLinksInput): Promise<readonly ProblemRiskLinkRecord[]> {
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
