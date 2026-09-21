/**
 * 009-indicators-reports, Fase 2 (T011) — registers the
 * `AuditEntityType.REPORT` field allow-list
 * (`core/audit/domain/audit-field-allowlist.ts`, data-model.md §1).
 * Follows `modules/indicators/domain/indicator-audit-allowlist.ts`'s exact
 * convention — see that file's header for the full reasoning this one
 * deliberately does not repeat.
 *
 * Fields, checked against `schema.prisma`'s `model ReportDefinition`:
 * `code`/`name`/`description`/`metricKeys`/`isActive` are every field a
 * future `CreateReportDefinitionUseCase`/edit use case (Fase 5, out of
 * THIS task's scope) could ever write. `createdByUserId`/`createdAt`/
 * `updatedAt` are deliberately excluded, same reasoning as
 * `IndicatorDefinition`'s own allow-list. `ReportDefinition` has no
 * lifecycle-transition entity type of its own (no `isActive` edge beyond
 * the same deactivate/reactivate shape `Asset`/`Process` already use) and
 * no measurement/history table (spec.md FR-028 — a report is never
 * snapshotted), so this is the ONE entity type this module registers.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process, exactly
 * like `registerIndicatorAuditAllowlists`. */
export function registerReportAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.REPORT, [
    'code',
    'name',
    'description',
    'metricKeys',
    'isActive',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetIndicatorAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetReportAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
