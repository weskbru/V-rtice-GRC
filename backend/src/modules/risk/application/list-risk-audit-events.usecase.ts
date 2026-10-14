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
