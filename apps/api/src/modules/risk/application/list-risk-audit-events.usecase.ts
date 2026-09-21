/**
 * T168/US7 — `ListRiskAuditEventsUseCase`: the application-layer side of
 * `GET /risks/{riskId}/audit-events`
 * (`contracts/risks.openapi.yaml`'s `listRiskAuditEvents` operation).
 *
 * ## Why this — not a plain `@RequirePermission` — decides 404 vs 403
 *
 * The contract's own prose states TWO independent gates with DIFFERENT
 * refusal codes: "A caller without `audit:view` who can otherwise see the
 * risk receives `403` ... A caller who cannot see the risk at all receives
 * `404`". A single `@RequirePermission(identifier)` decorator can only
 * express ONE permission and always refuses with `403`
 * (`PermissionGuard`) — it cannot express "missing THIS permission is a
 * 404, missing THAT one is a 403". `AuditController` therefore marks this
 * route `@NoPermissionRequired()` (still requires a valid session — only
 * the PERMISSION check is skipped) and this use case performs both real
 * checks itself, in the order the contract states them:
 *
 * 1. `risk:view`, checked directly via `PermissionResolverService` (never
 *    the guard) — missing it, OR the risk being out of scope, OR the risk
 *    not existing at all, are all folded into the SAME
 *    `NotFoundDomainError` (byte-identical 404, ADR-009): "cannot see the
 *    risk at all" is deliberately one outcome, not three distinguishable
 *    ones.
 * 2. `audit:view`, checked only once step 1 has succeeded — missing it is
 *    `ForbiddenDomainError` (403): the risk's existence is already known to
 *    this caller, so refusing with 403 rather than 404 discloses nothing
 *    new (US7 AS4, the contract's own reasoning).
 *
 * This mirrors `PerformTransitionUseCase`'s own `@NoPermissionRequired()` +
 * per-request permission check pattern (`lifecycle.controller.ts`) — the
 * SAME shape of problem (one route, non-uniform permission logic) that
 * pattern already exists in this codebase to solve.
 *
 * ## Scope for the "child records" (contract: "the risk and its child
 * records")
 *
 * Limited, deliberately, to the SAME five categories
 * `RiskHistoryQueryService`/ADR-006 cover: the risk itself plus its
 * assessments, treatment decisions, lifecycle transitions and approvals.
 * Treatment actions and control/process/asset links are NOT included in
 * this pass — see the implementation report for why (CLAUDE.md §2: no
 * unspecified functionality; this task's own scope names five categories,
 * matching the History view it complements).
 *
 * No transaction and no audit entry — reads are not audited (ADR-005).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditQueryService } from '../../../core/audit/application/audit-query.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';
import { RiskAssessmentRepositoryPort } from '../domain/ports/risk-assessment-repository.port';
import { RiskLifecycleTransitionRepositoryPort } from '../domain/ports/risk-lifecycle-transition-repository.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import type {
  AuditEntityRef,
  AuditEventPage,
} from '../../../core/audit/domain/ports/audit-event-reader.port';

const RISK_ENTITY_LABEL = 'Risco';
/** Comfortably exceeds any plausible single risk's lifetime total — see
 * `risk-history.service.ts`'s identical `ALL_ROWS_PAGE_SIZE` for the same
 * reasoning; this use case reuses the same two paginated repositories
 * purely to enumerate child ids, not to render them. */
const ALL_ROWS_PAGE_SIZE = 10_000;

export interface ListRiskAuditEventsInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly action?: string | undefined;
  readonly actorUserIdFilter?: string | undefined;
  readonly occurredFrom?: Date | undefined;
  readonly occurredTo?: Date | undefined;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class ListRiskAuditEventsUseCase {
  constructor(
    private readonly riskRepository: RiskRepositoryPort,
    private readonly assessmentRepository: RiskAssessmentRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly transitionRepository: RiskLifecycleTransitionRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditQueryService: AuditQueryService,
  ) {}

  async execute(input: ListRiskAuditEventsInput): Promise<AuditEventPage> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const canViewRisk = await this.permissionResolver.hasPermission(input.actorUserId, 'risk:view');
    const risk = canViewRisk ? await this.riskRepository.findById(scope, input.riskId) : undefined;
    if (!risk) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    const canViewAudit = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'audit:view',
    );
    if (!canViewAudit) {
      throw new ForbiddenDomainError();
    }

    const entityRefs = await this.collectEntityRefs(input.riskId);

    return this.auditQueryService.query({
      entityRefs,
      action: input.action,
      actorUserId: input.actorUserIdFilter,
      occurredFrom: input.occurredFrom,
      occurredTo: input.occurredTo,
      scope,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  private async collectEntityRefs(riskId: string): Promise<readonly AuditEntityRef[]> {
    const [assessments, decisions, transitions, approvals] = await Promise.all([
      this.assessmentRepository.listByRisk(riskId, 1, ALL_ROWS_PAGE_SIZE),
      this.treatmentDecisionRepository.listByRisk(riskId, 1, ALL_ROWS_PAGE_SIZE),
      this.transitionRepository.listByRisk(riskId),
      this.approvalRepository.listByEntity('RISK', riskId),
    ]);

    return [
      { entityType: AuditEntityType.RISK, entityId: riskId },
      ...assessments.items.map((a) => ({
        entityType: AuditEntityType.RISK_ASSESSMENT,
        entityId: a.id,
      })),
      ...decisions.items.map((d) => ({
        entityType: AuditEntityType.RISK_TREATMENT_DECISION,
        entityId: d.id,
      })),
      ...transitions.map((t) => ({
        entityType: AuditEntityType.RISK_LIFECYCLE_TRANSITION,
        entityId: t.id,
      })),
      ...approvals.map((a) => ({ entityType: AuditEntityType.APPROVAL, entityId: a.id })),
    ];
  }
}
