/**
 * 008-incidents-problems, foundation — registers the
 * `AuditEntityType.INCIDENT` field allow-list
 * (`core/audit/domain/audit-field-allowlist.ts`, data-model.md §4).
 * Follows `modules/assets/domain/asset-audit-allowlist.ts`'s exact
 * convention — see that file's header for why this is a registry call, not
 * a hard-coded object literal in `core/audit/**` (ADR-011).
 *
 * One entity type covers creation, every descriptive edit, and every
 * lifecycle transition (research.md D-4's own reasoning: few, named
 * transitions, captured as a field change on this same type — the same
 * shape `Asset`/`FrameworkVersion` already use). The allow-list is the
 * union of every field any future use case will ever write to this type —
 * none of those use cases exist yet (Fase 3, tasks.md's own scope); this
 * registration only needs to EXIST so `AuditRecorder.record(...)` does not
 * throw `AuditFieldAllowlistNotRegisteredError` the moment one does.
 *
 * Also registers the three link-table entity types this module OWNS the
 * write side of (data-model.md §2): `INCIDENT_RISK_LINK`,
 * `INCIDENT_ASSET_LINK`, `INCIDENT_PROCESS_LINK` — same
 * `[originId, targetId, 'unlinkedAt']` shape `FINDING_RISK_LINK`/
 * `RISK_ASSET_LINK` already establish.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process, exactly
 * like `registerAssetAuditAllowlists`. */
export function registerIncidentAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.INCIDENT, [
    'code',
    'title',
    'description',
    'severity',
    'orgUnitId',
    'ownerUserId',
    'reportedByUserId',
    'reportedOn',
    'status',
    'resolutionSummary',
    'resolvedAt',
    'resolvedByUserId',
    'closedAt',
    'closedByUserId',
    'cancellationReason',
    'cancelledAt',
    'cancelledByUserId',
    // Never a persisted column (data-model.md §1) — reaches only a
    // reopen transition's own audit `newValues`
    // (`incident.entity.ts#assertReopenReasonProvided`'s own header).
    'reopenReason',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_RISK_LINK, [
    'incidentId',
    'riskId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_ASSET_LINK, [
    'incidentId',
    'assetId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.INCIDENT_PROCESS_LINK, [
    'incidentId',
    'processId',
    'unlinkedAt',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetAssetAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetIncidentAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
