/**
 * T091 — maps `RiskRecord` (the repository's domain-level read model,
 * `domain/ports/risk-repository.port.ts`) to the wire shape
 * `contracts/risks.openapi.yaml`'s `RiskDetail` describes. This is the ONLY
 * place a `Risk` becomes a response body — no Prisma model, and no
 * `RiskRecord` either, is ever returned directly from `RiskController`
 * (ADR-009: "A response mapper per resource is the only place a domain
 * object becomes a DTO").
 *
 * ## `currentAssessment` (T126)
 *
 * Delegates to `assessment-response.mapper.ts`'s `toAssessmentResponse` —
 * the ONE mapping from an assessment to its wire shape (ADR-009) — rather
 * than re-deriving `RiskAssessment`'s fields here. `record.currentAssessment`
 * and `record.previousAssessmentLevels` are already populated by
 * `RiskRepository.findById`'s own include tree (no extra query this mapper
 * has to issue).
 *
 * ## `currentTreatment`, `controls`, `processes`, `assets`,
 * `treatmentActionSummary` (US5 backend gap closed alongside T136/T144-T146)
 *
 * These used to be hardcoded null/empty because the US5 write paths did not
 * exist yet. They now do, so `toRiskDetailResponse` takes a
 * `RiskDetailAggregate` (`application/get-risk-detail.usecase.ts`) rather
 * than a bare `RiskRecord`, and delegates each section to the SAME response
 * mapper its own list endpoint already uses (ADR-009, one mapping per
 * business concept): `toTreatmentDecisionResponse`
 * (`treatment-decision-response.mapper.ts`), `toControlLinkResponse` /
 * `toEntityLinkResponse` (`risk-relationship-response.mapper.ts`). No second
 * mapping of any of these entities is written here.
 *
 * ## `pendingApprovalDetail` (assurance Fix 4)
 *
 * Used to be hardcoded `null` unconditionally — the comment here read "it
 * belongs to US6, whose write path does not exist yet"; that write path
 * has since shipped (`RequestApprovalUseCase`/`DecideApprovalUseCase`), so
 * `GET /risks/{id}` kept reporting `pendingApproval: true,
 * pendingApprovalDetail: null` even when `GET /risks/{id}/approvals`
 * already returned the real `PENDING` row. Now delegates to the SAME
 * `toApprovalResponse` mapper that endpoint uses (ADR-009, one mapping per
 * business concept), fed by `GetRiskDetailUseCase.pendingApprovalDetail`
 * (`get-risk-detail.usecase.ts`'s own header explains the query).
 *
 * `overdueTreatment` (inherited from `RiskSummary` via the contract's
 * `allOf`) had the SAME hardcoded-`false` defect and is fixed in the same
 * pass: it is now `treatmentActionSummary.overdue > 0`, the identical rule
 * `risk-query.service.ts`'s register query already computes in SQL
 * (`overdueTreatmentExistsFragment`) — same source data, so the two can
 * never disagree.
 */
import { todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';
import { isOverdueReview } from '../../domain/risk-overdue';

import { toApprovalResponse, type ApprovalResponse } from './approval-response.mapper';
import { toAssessmentResponse, type AssessmentResponse } from './assessment-response.mapper';
import {
  toControlLinkResponse,
  toEntityLinkResponse,
  type ControlLinkResponse,
  type EntityLinkResponse,
} from './risk-relationship-response.mapper';
import {
  toTreatmentDecisionResponse,
  type TreatmentDecisionResponse,
} from './treatment-decision-response.mapper';

import type { RiskDetailAggregate } from '../../application/get-risk-detail.usecase';
import type { RiskRecord, RiskStatementRecord } from '../../domain/ports/risk-repository.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export interface ReferenceDataRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RiskStatementResponse {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

export interface TreatmentActionSummaryResponse {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

/** Shape of `contracts/risks.openapi.yaml`'s `RiskDetail` (`RiskSummary`
 * flattened in, per that schema's `allOf`). */
export interface RiskDetailResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefResponse | null;
  readonly type: ReferenceDataRefResponse | null;
  readonly origin: ReferenceDataRefResponse | null;
  readonly orgUnit: OrgUnitRefResponse;
  readonly owner: UserRefResponse;
  readonly responsible: UserRefResponse | null;
  readonly causes: readonly RiskStatementResponse[];
  readonly consequences: readonly RiskStatementResponse[];
  readonly currentAssessment: AssessmentResponse | null;
  readonly currentTreatment: TreatmentDecisionResponse | null;
  readonly controls: readonly ControlLinkResponse[];
  readonly processes: readonly EntityLinkResponse[];
  readonly assets: readonly EntityLinkResponse[];
  readonly treatmentActionSummary: TreatmentActionSummaryResponse;
  readonly pendingApprovalDetail: ApprovalResponse | null;
  readonly inherentScore: number | null;
  readonly inherentLevel: RiskLevel | null;
  readonly residualScore: number | null;
  readonly residualLevel: RiskLevel | null;
  readonly identifiedOn: string;
  readonly lastAssessedOn: string | null;
  readonly nextReviewOn: string | null;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Trivial aggregate for a risk that provably has none of this data yet —
 * `POST /risks` (a brand-new `DRAFT` risk can never have a treatment
 * decision, a link or a treatment action). NOT used for `PATCH
 * /risks/{riskId}`: that endpoint updates an EXISTING risk, which may
 * already carry treatment/link data this shortcut would incorrectly hide.
 * See this task's report for that gap, deliberately left open (out of
 * scope for this task; only `GET /risks/{riskId}` was in scope). */
export function toEmptyRiskDetailAggregate(risk: RiskRecord): RiskDetailAggregate {
  return {
    risk,
    currentTreatment: undefined,
    currentTreatmentHasOutstandingActions: false,
    controls: [],
    processes: [],
    assets: [],
    treatmentActionSummary: { total: 0, open: 0, overdue: 0 },
    pendingApprovalDetail: undefined,
  };
}

export function toRiskDetailResponse(aggregate: RiskDetailAggregate): RiskDetailResponse {
  const record = aggregate.risk;
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    description: record.description,
    status: record.status,
    category: toReferenceDataRefResponse(record.category),
    type: toReferenceDataRefResponse(record.type),
    origin: toReferenceDataRefResponse(record.origin),
    orgUnit: { id: record.orgUnit.id, code: record.orgUnit.code, name: record.orgUnit.name },
    owner: toUserRefResponse(record.owner),
    responsible: record.responsible ? toUserRefResponse(record.responsible) : null,
    causes: toRiskStatementResponses(record.causes),
    consequences: toRiskStatementResponses(record.consequences),
    currentAssessment: record.currentAssessment
      ? toAssessmentResponse(record.currentAssessment, record.previousAssessmentLevels)
      : null,
    currentTreatment: aggregate.currentTreatment
      ? toTreatmentDecisionResponse(
          aggregate.currentTreatment,
          aggregate.currentTreatmentHasOutstandingActions,
        )
      : null,
    controls: aggregate.controls.map(toControlLinkResponse),
    processes: aggregate.processes.map(toEntityLinkResponse),
    assets: aggregate.assets.map(toEntityLinkResponse),
    treatmentActionSummary: aggregate.treatmentActionSummary,
    pendingApprovalDetail: aggregate.pendingApprovalDetail
      ? toApprovalResponse(aggregate.pendingApprovalDetail)
      : null,
    inherentScore: record.inherentScore ?? null,
    inherentLevel: record.inherentLevel ?? null,
    residualScore: record.residualScore ?? null,
    residualLevel: record.residualLevel ?? null,
    identifiedOn: toDateOnlyString(record.identifiedOn),
    lastAssessedOn: record.lastAssessedOn ? toDateOnlyString(record.lastAssessedOn) : null,
    nextReviewOn: record.nextReviewOn ? toDateOnlyString(record.nextReviewOn) : null,
    overdueReview: isOverdueReview(record.nextReviewOn, todayDateOnlyUtc()),
    // T141/US5 parity fix (found alongside this task's `currentTreatment`/
    // `controls`/`processes`/`assets` gap, same hardcoded-false defect):
    // `RiskSummary.overdueTreatment` — inherited into `RiskDetail` via the
    // contract's `allOf` — was likewise hardcoded `false` here while the
    // register (`risk-query.service.ts`'s `overdueTreatmentExistsFragment`)
    // already computes it for real from the IDENTICAL rule
    // (`isOverdueTreatmentAction`'s predicate: at least one non-terminal
    // action past its due date). `treatmentActionSummary.overdue` is that
    // same count, already fetched for this response — reusing it here
    // costs no extra query and cannot disagree with the register by
    // construction (same source data, same predicate).
    overdueTreatment: aggregate.treatmentActionSummary.overdue > 0,
    pendingApproval: record.pendingApprovalId !== undefined,
    version: record.version,
    archivedAt: record.archivedAt ? record.archivedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toReferenceDataRefResponse(
  ref: { id: string; code: string; name: string } | undefined,
): ReferenceDataRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

function toUserRefResponse(ref: { id: string; fullName: string; email: string }): UserRefResponse {
  return { id: ref.id, fullName: ref.fullName, email: ref.email };
}

/** Exported for reuse by `risk.controller.ts`'s `replaceCauses`/
 * `replaceConsequences` (`PUT /risks/{riskId}/causes|consequences`) — the
 * ONE mapping from `RiskStatementRecord` to its wire shape (ADR-009),
 * whether reached via the full `RiskDetail` body or the bare array those
 * two operations return. */
export function toRiskStatementResponses(
  statements: readonly RiskStatementRecord[],
): readonly RiskStatementResponse[] {
  return statements.map((statement) => ({
    id: statement.id,
    description: statement.description,
    sortOrder: statement.sortOrder,
  }));
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
