/**
 * T014/002-shared-grc-foundation — registers the `AuditEntityType.EVIDENCE`/
 * `EVIDENCE_LINK`/`ACTION`/`FINDING` field allow-lists
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-028/FR-029/FR-035).
 * Follows `modules/risk/domain/risk-audit-allowlist.ts` exactly — see that
 * file's header for the extension point this exercises: "a future business
 * module calls the same function for its own entity types from its own
 * module file. Nothing here is edited to add one." `core/audit/**` is
 * never touched by this file (ADR-016).
 *
 * ## Called once, idempotently, by whichever GRC kernel module boots first
 *
 * Unlike `registerRiskAuditAllowlists()` — one module (`RiskModule`) calling
 * one function — the three capabilities this feature adds (`EvidenceModule`/
 * `ActionModule`/`FindingModule`, T035/T054/T074, all out of this task's
 * scope) are siblings under `grc/`, none of which owns this file
 * exclusively. `registerGrcAuditAllowlists()` is idempotent (the same
 * `registered` guard `registerRiskAuditAllowlists()` uses) specifically so
 * any subset of those three modules may call it from their own constructor
 * without caring whether another sibling already has — exactly as safe as
 * calling it from all three, or from only the first one to be wired into
 * `AppModule`.
 *
 * `registerAuditFieldAllowlist` itself throws if the SAME entity type is
 * registered twice (`audit-field-allowlist.ts`) — each of the four blocks
 * below therefore lists that entity type's COMPLETE field set once, up
 * front, rather than growing incrementally across several tasks the way
 * `RISK`'s own list historically did across US2/US4/US5/US6 (a difference
 * forced by this task laying the foundation before any of the three
 * capabilities' use cases exist yet, not a deviation from the registration
 * mechanism itself).
 *
 * ## The recurring "actor is already the audit row's own actor" exclusion
 *
 * Every list below excludes the `*ByUserId` companion of a `*At` timestamp
 * (`archivedByUserId`, `unlinkedByUserId`, `completedByUserId`,
 * `reopenedByUserId`, `closedByUserId`) — the SAME reasoning
 * `risk-audit-allowlist.ts` gives for `RISK_CONTROL_LINK`'s list including
 * `unlinkedAt` but not `unlinkedByUserId`: the audit row's own `actorId`
 * already names who performed the action, so a second column carrying the
 * identical value would be pure noise, not new information.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (e.g.
 * multiple Nest testing modules importing `EvidenceModule`/`ActionModule`/
 * `FindingModule` within one test run), exactly like
 * `registerRiskAuditAllowlists()`. */
export function registerGrcAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // Evidence create/update/archive (a later task's `CreateEvidenceUseCase`/
  // `UpdateEvidenceUseCase`/`ArchiveEvidenceUseCase`, US1) share ONE
  // allow-list — the same "one list per entity type, not one per
  // operation" convention `RISK_TREATMENT_ACTION`'s own comment documents.
  // `id`/`code` excluded: `code` never changes after creation (R-008) and
  // both are already the audit row's own `entityId` context — identical
  // reasoning to `RISK`'s own exclusion.
  registerAuditFieldAllowlist(AuditEntityType.EVIDENCE, [
    'orgUnitId',
    'title',
    'description',
    'type',
    'source',
    'ownerUserId',
    'collectedOn',
    'validUntil',
    'fileId',
    'externalUrl',
    'observation',
    'status',
    'archivedAt',
  ]);

  // Evidence link/unlink (US1). `linkedAt` excluded — already the audit
  // row's own `occurredAt` for the `evidence.linked` event; same reasoning
  // `RISK_CONTROL_LINK` applies to its own `linkedAt`/`linkedByUserId`.
  registerAuditFieldAllowlist(AuditEntityType.EVIDENCE_LINK, [
    'evidenceId',
    'subjectType',
    'subjectId',
    'note',
    'unlinkedAt',
  ]);

  // Action create/update/transition (US2). `reopenReason` covers FR-016's
  // "reopening ... with ... justification" requirement.
  registerAuditFieldAllowlist(AuditEntityType.ACTION, [
    'originType',
    'originId',
    'title',
    'description',
    'responsibleUserId',
    'dueOn',
    'status',
    'completedAt',
    'reopenedAt',
    'reopenReason',
  ]);

  // Finding create/update/close/reopen/archive (US3). `closureJustification`
  // covers FR-026's "encerramento sem ação ... exige justificativa
  // registrada" requirement. `reopenReason` is NOT a `Finding` column
  // (data-model.md §5 declares none) — it exists ONLY as an audit-payload
  // key on `finding.reopened`'s `newValues`
  // (`ReopenFindingUseCase`/T071a), so it must still be allow-listed here
  // or `applyAuditFieldAllowlist` would silently drop it, leaving the
  // reopen reason nowhere in the system at all. This is the one addition
  // T014's original "complete field set once, up front" list did not
  // anticipate, made when US3 actually needed it.
  registerAuditFieldAllowlist(AuditEntityType.FINDING, [
    'orgUnitId',
    'title',
    'description',
    'recommendation',
    'category',
    'origin',
    'severity',
    'priority',
    'ownerUserId',
    'identifiedOn',
    'status',
    'closedAt',
    'closureJustification',
    'reopenReason',
    'archivedAt',
    // 005-audit-findings, T004/T020 (data-model.md §7, research.md D-5) —
    // set once, by `CreateFindingFromEngagementUseCase` (`grc/finding`,
    // Fase 4, out of this task's own scope), on `finding.created`'s own
    // `newValues`. Additive — every field above is unchanged.
    'auditEngagementId',
  ]);

  // 005-audit-findings, T020 (research.md D-9) — the two `Finding`
  // relationships Phase 1 deferred (data-model.md §5-§6, ADR-020 parts
  // 1/2). Append-only events — every field IS the "new value" for
  // `finding_control_link.linked`/`finding_risk_link.linked`; `unlinkedAt`
  // covers the withdrawal event, the same shape `EVIDENCE_LINK` above
  // already establishes for its own `unlinkedAt`.
  registerAuditFieldAllowlist(AuditEntityType.FINDING_CONTROL_LINK, [
    'findingId',
    'controlId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.FINDING_RISK_LINK, [
    'findingId',
    'riskId',
    'unlinkedAt',
  ]);
}
