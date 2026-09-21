/**
 * T019/005-audit-findings — registers the `AuditEntityType.AUDIT_ENGAGEMENT`,
 * `AUDIT_SCOPE_FRAMEWORK_VERSION`, `AUDIT_SCOPE_REQUIREMENT` and
 * `AUDIT_SCOPE_CONTROL` field allow-lists
 * (`core/audit/domain/audit-field-allowlist.ts`, FR-020). Follows
 * `modules/controls/domain/control-audit-allowlist.ts`'s exact
 * convention — see that file's header for why this is a registry call, not
 * a hard-coded object literal in `core/audit/**` (ADR-011).
 *
 * Called from `AuditEngagementsModule`'s own constructor
 * (`audit-engagements.module.ts`), the composition root — mirroring
 * `RiskModule`'s own `registerRiskAuditAllowlists()` call.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process (multiple
 * Nest testing modules within one test run), exactly like
 * `registerControlAuditAllowlists`. */
export function registerAuditEngagementAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  // `CreateAuditEngagementUseCase`/`UpdateAuditEngagementUseCase` audit the
  // engagement's own descriptive fields; the three lifecycle transitions
  // (start/complete/cancel) each audit their OWN `status` field change
  // through this SAME entity type, one event per intention
  // (`audit_engagement.created`/`.updated`/`.started`/`.completed`/
  // `.cancelled`), never one generic `.updated` covering all five
  // (FR-020). `code`/`version` are deliberately excluded — `code` never
  // changes after creation (data-model.md §1) and is already the audit
  // row's own `entityId` context; `version` is the optimistic-lock
  // counter, not business content — the same reasoning
  // `control-audit-allowlist.ts` gives for excluding its own equivalents.
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_ENGAGEMENT, [
    'objective',
    'periodStart',
    'periodEnd',
    'orgUnitId',
    'leadAuditorUserId',
    'status',
    'startedAt',
    'startedByUserId',
    'completedAt',
    'completedByUserId',
    'cancelledAt',
    'cancelledByUserId',
    'cancellationJustification',
  ]);

  // The three scope-link use cases each audit an append-only event — every
  // field IS the "new value" (no `previousValues` ever recorded for these,
  // there is no unlink operation to reverse, research.md D-12) — the same
  // shape `RISK_CONTROL_LINK` etc. already document.
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_FRAMEWORK_VERSION, [
    'auditEngagementId',
    'frameworkVersionId',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_REQUIREMENT, [
    'auditEngagementId',
    'requirementId',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.AUDIT_SCOPE_CONTROL, [
    'auditEngagementId',
    'controlId',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetControlAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetAuditEngagementAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
