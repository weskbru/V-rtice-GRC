/**
 * US5 backend gap (architect-directed, alongside T136/T144/T145/T146) —
 * `GetRiskDetailUseCase`: the read side of `GET /risks/{riskId}`'s FULL
 * response body. Wraps `GetRiskUseCase` (scope check + the risk row itself,
 * unchanged) and adds the US5 data `RiskDetailResponse` requires
 * (`currentTreatment`, `controls`, `processes`, `assets`,
 * `treatmentActionSummary`) — previously hardcoded null/empty in
 * `risk-response.mapper.ts` because the write paths did not exist yet; they
 * now do (T139-T143), so the read path must reflect them.
 *
 * Deliberately a SEPARATE use case from `GetRiskUseCase`, not an added
 * branch inside it: `GetRiskUseCase.execute` is also called — its result
 * discarded — purely to authorize/resolve the parent risk by every
 * treatment and relationship endpoint (`TreatmentController`,
 * `RiskRelationshipController`, `AssessmentController`). Enriching
 * `GetRiskUseCase` itself would add five more queries to every one of those
 * calls, none of which render this data. Only `RiskController.findById`
 * needs the full aggregate, so only it depends on this class.
 *
 * Every read below reuses an EXISTING repository method already exercised
 * elsewhere (`TreatmentController.listTreatments`/`listTreatmentActions`,
 * `RiskRelationshipController.listControlLinks`) — no new query method was
 * added to any port for this task, per the instruction to reuse the
 * existing treatment/relationship mappers and repositories rather than
 * building a second path to the same data (Constitution I).
 *
 * ## Query shape (measured — see the mapper/controller for the reported count)
 *
 * `GetRiskUseCase.execute` issues the risk's own query (plus scope
 * resolution). The reads below are independent of each other and run in
 * `Promise.all` in one round of parallel queries; only
 * `currentTreatmentHasOutstandingActions` depends on `currentTreatment`'s id
 * and therefore cannot start until that first batch resolves — a second,
 * single query, issued only when the risk actually has a current treatment
 * decision. None of this scales with the NUMBER of controls/processes/
 * assets/actions a risk has (each list is one query regardless of row
 * count) — the fixed addition is exactly 6 queries when there is a current
 * treatment decision, 5 when there is not (`pendingApprovalDetail`'s own
 * lookup below is skipped entirely, not merely cheap, when the risk has no
 * `pendingApprovalId` at all).
 *
 * ## Assurance fix (Fix 4, confirmed defect) — `pendingApprovalDetail`
 *
 * Used to be hardcoded `null` unconditionally ("belongs to US6, whose
 * write path does not exist yet" — that write path has since shipped).
 * `GET /risks/{id}/approvals` already returns the real `PENDING` approval;
 * this now surfaces the SAME row inline, via the SAME
 * `risk.pendingApprovalId !== undefined ? approvalRepository.findById(...)
 * : undefined` pattern `GetRiskLifecycleUseCase` already establishes for
 * its own `pendingApproval` field — reusing that exact port method rather
 * than introducing a second way to find the current pending approval.
 */
import { Injectable } from '@nestjs/common';

import { ApprovalRepositoryPort } from '../domain/ports/approval-repository.port';
import {
  RiskAssetLinkRepositoryPort,
  RiskControlLinkRepositoryPort,
  RiskProcessLinkRepositoryPort,
} from '../domain/ports/risk-relationship-repository.port';
import { RiskTreatmentActionQueryPort } from '../domain/ports/risk-treatment-action-query.port';
import { RiskTreatmentActionRepositoryPort } from '../domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../domain/ports/risk-treatment-decision-repository.port';

import { GetRiskUseCase } from './get-risk.usecase';

import type { GetRiskInput } from './get-risk.usecase';
import type { ApprovalRecord } from '../domain/ports/approval-repository.port';
import type {
  ControlLinkRecord,
  EntityLinkRecord,
} from '../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../domain/ports/risk-repository.port';
import type { TreatmentActionSummary } from '../domain/ports/risk-treatment-action-query.port';
import type { TreatmentDecisionRecord } from '../domain/ports/risk-treatment-decision-repository.port';

/** Everything `toRiskDetailResponse` needs beyond the bare `RiskRecord` —
 * one domain record/collection per `RiskDetailResponse` field that used to
 * be hardcoded null/empty. */
export interface RiskDetailAggregate {
  readonly risk: RiskRecord;
  readonly currentTreatment: TreatmentDecisionRecord | undefined;
  /** FR-075's `deadlineOverdue` input for `currentTreatment` specifically —
   * identical meaning to the flag `TreatmentController.listTreatments`
   * computes per page, narrowed to the one decision this response needs. */
  readonly currentTreatmentHasOutstandingActions: boolean;
  readonly controls: readonly ControlLinkRecord[];
  readonly processes: readonly EntityLinkRecord[];
  readonly assets: readonly EntityLinkRecord[];
  readonly treatmentActionSummary: TreatmentActionSummary;
  /** Assurance fix (Fix 4) — the SAME `PENDING` approval `GET
   * /risks/{id}/approvals` already returns, or `undefined` when
   * `risk.pendingApprovalId` is unset. */
  readonly pendingApprovalDetail: ApprovalRecord | undefined;
}

@Injectable()
export class GetRiskDetailUseCase {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentActionQuery: RiskTreatmentActionQueryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly processLinkRepository: RiskProcessLinkRepositoryPort,
    private readonly assetLinkRepository: RiskAssetLinkRepositoryPort,
    private readonly approvalRepository: ApprovalRepositoryPort,
  ) {}

  async execute(input: GetRiskInput): Promise<RiskDetailAggregate> {
    const risk = await this.getRiskUseCase.execute(input);

    const [
      currentTreatment,
      controls,
      processes,
      assets,
      treatmentActionSummary,
      pendingApprovalDetail,
    ] = await Promise.all([
      this.treatmentDecisionRepository.findCurrentByRisk(risk.id),
      // FR-078 — "current control links, shown where they influence
      // residual risk": active links only, matching the contract's
      // `RiskDetail.controls` description (`includeWithdrawn: false`).
      this.controlLinkRepository.listByRisk(risk.id, false),
      this.processLinkRepository.listByRisk(risk.id),
      this.assetLinkRepository.listByRisk(risk.id),
      this.treatmentActionQuery.summaryByRisk(risk.id),
      risk.pendingApprovalId !== undefined
        ? this.approvalRepository.findById(risk.pendingApprovalId)
        : Promise.resolve(undefined),
    ]);

    const currentTreatmentHasOutstandingActions = currentTreatment
      ? (
          await this.treatmentActionRepository.findDecisionIdsWithOutstandingActions([
            currentTreatment.id,
          ])
        ).has(currentTreatment.id)
      : false;

    return {
      risk,
      currentTreatment,
      currentTreatmentHasOutstandingActions,
      controls,
      processes,
      assets,
      treatmentActionSummary,
      pendingApprovalDetail,
    };
  }
}
