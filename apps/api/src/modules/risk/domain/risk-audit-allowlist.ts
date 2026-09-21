/**
 * T089/T090 — registers the `AuditEntityType.RISK` field allow-list
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-035). Called once, from
 * `RiskModule`'s own constructor (`risk.module.ts`) — the exact extension
 * point that file's header describes: "a future business module (e.g. Risk
 * Management) calls the same function for its own entity types from its own
 * module file. Nothing here is edited to add one." `core/audit/**` is never
 * touched by this file or by anything in `modules/risk/**` (ADR-011).
 *
 * Every field below is checked against `schema.prisma`'s `Risk` model,
 * field-by-field. Deliberately excluded, with the reason:
 *   - `id`, `code` — `code` never changes after creation (FR-054) and both
 *     are already the audit row's own `entityId` context; there is nothing
 *     to "diff" for either.
 *   - `status`, `currentAssessmentId`, `currentTreatmentId`,
 *     `pendingApprovalId`, `inherentScore`/`inherentLevel`/`residualScore`/
 *     `residualLevel`, `archivedAt` — none of these are written by
 *     `CreateRiskUseCase`/`UpdateRiskUseCase` (T089/T090 only create/edit
 *     business content); they belong to the assessment/treatment/lifecycle
 *     use cases of later user stories, which register any additional
 *     allow-listed fields THEY need when they land, exactly as this file
 *     does now — never by editing this list preemptively for a write path
 *     that does not exist yet.
 *   - `version` — the optimistic-lock counter (ADR-013) is a concurrency
 *     mechanism, not business content; its value is implicit in "a risk was
 *     updated" and would be pure noise in every single audit row.
 *   - `createdAt`/`updatedAt` — already the audit row's own `occurredAt`.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent, exactly like `registerCoreEntityAuditAllowlists` — safe to
 * call more than once in the same process (e.g. multiple Nest testing
 * modules importing `RiskModule` within one test run). */
export function registerRiskAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.RISK, [
    'title',
    'description',
    'categoryId',
    'typeId',
    'originId',
    'orgUnitId',
    'ownerUserId',
    'responsibleUserId',
    'identifiedOn',
    'nextReviewOn',
    // T093 — `ReplaceRiskStatementsUseCase` (`PUT /risks/{riskId}/causes|
    // consequences`, FR-057). Not `Risk` columns (they live on the
    // risk-owned `RiskCause`/`RiskConsequence` tables), but CLAUDE.md §8/
    // this use case's own header: "a replaced list is a change to the
    // risk" — audited against THIS entity type, one ordered array of
    // descriptions per field, not a per-row event.
    'causes',
    'consequences',
  ]);

  // T124/US4 — `CreateAssessmentUseCase` audits the new assessment itself
  // (an append-only record — every field IS the "new value", there is no
  // "previous value" to diff against, unlike `RISK`'s edit-diff shape
  // above).
  registerAuditFieldAllowlist(AuditEntityType.RISK_ASSESSMENT, [
    'riskId',
    'methodologyVersionId',
    'assessedOn',
    'inherentProbability',
    'inherentImpact',
    'inherentScore',
    'inherentLevel',
    'residualProbability',
    'residualImpact',
    'residualScore',
    'residualLevel',
    'controlsConsidered',
    'previousAssessmentId',
  ]);

  // T126/US4 — `PublishMethodologyVersionUseCase` audits the newly
  // published version, same "no previous value" shape as above (a new
  // version is never a diff of the old one — data-model.md §7/FR-068).
  // `rationale` and the raw scale/matrix/band JSONB are deliberately
  // excluded — the version's own `id`/`versionNumber` already lets an
  // auditor pull the full configuration back from `risk_methodology_
  // versions`, and duplicating a whole JSONB blob into every audit row
  // would be pure noise (same "moved by reference, not by value"
  // reasoning as `controlsConsidered`'s own snapshot design does NOT
  // apply here — that field is a business snapshot; this is an audit
  // payload, where the version row itself already IS the permanent
  // record).
  registerAuditFieldAllowlist(AuditEntityType.RISK_METHODOLOGY_VERSION, [
    'methodologyId',
    'versionNumber',
    'effectiveFrom',
  ]);

  // T139/US5 — `RecordTreatmentUseCase` audits the new decision itself
  // (append-only — every field IS the "new value"), same shape as
  // `RISK_ASSESSMENT` above. It does NOT audit the previous decision's
  // supersession as a separate `previousValues` diff: the new decision's own
  // audit row already names `previousTreatmentDecisionId` in `newValues`,
  // which is enough to trace the supersession without a second write.
  registerAuditFieldAllowlist(AuditEntityType.RISK_TREATMENT_DECISION, [
    'riskId',
    'strategy',
    'description',
    'deadline',
    'previousTreatmentDecisionId',
  ]);

  // T140/US5 — treatment action create/update/status-change. `dueOn` and
  // `status` cover FR-074a's explicit "status changes ... audited"
  // requirement; `treatmentDecisionId`/`responsibleUserId`/`title` cover
  // create and general field edits with the SAME allow-list (one list per
  // entity type, not one per operation — `AuditRecorder` already filters
  // `previousValues`/`newValues` independently, so a create's "no previous
  // value" case and an update's diff both pass through this same list).
  // `completedAt` (assurance Fix 3) — without it in the diff, a future
  // change to the completion timestamp (e.g. a re-stamp regression like the
  // one this fix corrects) would be invisible in `RiskTreatmentAction`'s
  // own audit trail even though `UpdateTreatmentActionUseCase` now reports
  // it.
  registerAuditFieldAllowlist(AuditEntityType.RISK_TREATMENT_ACTION, [
    'riskId',
    'treatmentDecisionId',
    'title',
    'description',
    'responsibleUserId',
    'dueOn',
    'status',
    'completedAt',
  ]);

  // T142/US5 — control/process/asset link and unlink (FR-076). Each link
  // table gets its OWN allow-list, matching the three distinct
  // `AuditEntityType` values added for them (see schema.prisma's own
  // comment on why this is not one generic "link" type).
  registerAuditFieldAllowlist(AuditEntityType.RISK_CONTROL_LINK, [
    'riskId',
    'controlId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.RISK_PROCESS_LINK, [
    'riskId',
    'processId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.RISK_ASSET_LINK, ['riskId', 'assetId', 'unlinkedAt']);

  // T156/US6 — `PerformTransitionUseCase`/`DecideApprovalUseCase` (the
  // APPROVED path) audit the newly applied transition itself (append-only —
  // every field IS the "new value"), same shape as `RISK_ASSESSMENT` above.
  registerAuditFieldAllowlist(AuditEntityType.RISK_LIFECYCLE_TRANSITION, [
    'riskId',
    'fromStatus',
    'toStatus',
    'justification',
    'approvalId',
  ]);

  // T157/US6 — `RequestApprovalUseCase`/`DecideApprovalUseCase` audit both
  // the request and each decision under this ONE entity type (one list per
  // entity type, not one per operation — the same convention
  // `RISK_TREATMENT_ACTION`'s own comment above documents for
  // create+update). `decision`/`toStatus` cover the decision events;
  // `requestedTransition` covers the request event.
  registerAuditFieldAllowlist(AuditEntityType.APPROVAL, [
    'riskId',
    'requestedTransition',
    'decision',
    'toStatus',
    'justification',
  ]);
}
