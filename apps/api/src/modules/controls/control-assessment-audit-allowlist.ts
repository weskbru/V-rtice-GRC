/**
 * T031-T036/003-controls-management, User Story 2/3 — registers the
 * `AuditEntityType.CONTROL_ASSESSMENT`/`CONTROL_PROCESS_LINK`/
 * `CONTROL_ASSET_LINK` field allow-lists
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-019/FR-020/FR-030).
 * Sits directly under `src/modules/controls/` — not under `domain/**` —
 * the same precedent `control-permissions.ts`'s own header documents:
 * files at a module's root are not classified by `eslint-plugin-boundaries`,
 * so no boundary policy restricts what this file may import, and it is
 * called from THIS workstream's own two composition roots
 * (`ControlAssessmentModule`/`ControlRelationshipModule`), never from
 * `controls.module.ts` (out of this task's scope to edit).
 *
 * `previousEffectiveness`/`newEffectiveness` are registered against
 * `CONTROL_ASSESSMENT` (not `CONTROL`) deliberately: the fact that CAUSES
 * an effectiveness change is the assessment's attestation, not an edit to
 * the control's own descriptive fields — the same "origin is the fact,
 * not the generic entity" reasoning research.md D-5 gives for
 * `ActionOriginType.CONTROL_ASSESSMENT`. Registering it there also avoids
 * editing `modules/controls/domain/control-audit-allowlist.ts` (the
 * concurrent catalogue/lifecycle workstream's own file) to add fields
 * unrelated to that file's own `CONTROL`/`CONTROL_LIFECYCLE_TRANSITION`
 * entries.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (multiple
 * Nest testing modules within one test run), exactly like
 * `registerControlAuditAllowlists`/`registerRiskAuditAllowlists`. */
export function registerControlAssessmentAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // `CreateControlAssessmentUseCase`/`RequestControlAssessmentAttestationUseCase`/
  // `DecideControlAssessmentAttestationUseCase` — every field this
  // workstream ever writes to `newValues`/`previousValues` for a
  // `CONTROL_ASSESSMENT`-typed audit event. `assessorUserId` is excluded:
  // it is already the audit row's own `actorId` on `control.assessment.recorded`
  // (the same "actor is already the audit row's own actor" exclusion
  // `grc-audit-allowlist.ts`'s header documents for every `*ByUserId`
  // companion of a `*At` timestamp).
  registerAuditFieldAllowlist(AuditEntityType.CONTROL_ASSESSMENT, [
    'controlId',
    'assessedOn',
    'result',
    'conclusion',
    'approvalId',
    'attestedAt',
    'attestedByUserId',
    'justification',
    'violatedRules',
    'previousEffectiveness',
    'newEffectiveness',
  ]);

  // `LinkControlToProcessUseCase`/`UnlinkControlFromProcessUseCase` —
  // `linkedAt`/`linkedByUserId` excluded (already the audit row's own
  // `occurredAt`/`actorId` on `control.process_linked`), mirroring
  // `RISK_PROCESS_LINK`'s own allow-list exactly. `controlId` IS included
  // (unlike the risk-side equivalents, which key the audit event by the
  // RISK, not the link) — here the audit event's own `entityId` is the
  // LINK's id, so `controlId` carries real information: which control this
  // process/asset link belongs to.
  registerAuditFieldAllowlist(AuditEntityType.CONTROL_PROCESS_LINK, [
    'controlId',
    'processId',
    'unlinkedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.CONTROL_ASSET_LINK, [
    'controlId',
    'assetId',
    'unlinkedAt',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetControlAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetControlAssessmentAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
