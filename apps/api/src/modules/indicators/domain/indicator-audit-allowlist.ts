/**
 * 009-indicators-reports, Fase 2 (T011) — registers the
 * `AuditEntityType.INDICATOR`/`INDICATOR_MEASUREMENT` field allow-lists
 * (`core/audit/domain/audit-field-allowlist.ts`, data-model.md §1-§2).
 * Follows `modules/incidents/domain/incident-audit-allowlist.ts`'s exact
 * convention — see that file's header for why this is a registry call, not
 * a hard-coded object literal in `core/audit/**` (ADR-011).
 *
 * ## Two entity types, not one — `IndicatorDefinition` vs
 * ## `IndicatorMeasurement` are different business facts
 *
 * `INDICATOR` covers `IndicatorDefinition`'s own descriptive/threshold
 * fields — creation and later edits (research.md-documented shape: few,
 * linear field changes, no lifecycle-transition entity type of its own,
 * schema.prisma's own `AuditEntityType` comment for this migration).
 * `INDICATOR_MEASUREMENT` is separate because it audits a different fact —
 * an append-only measurement's CREATION, never an edit (the table has
 * none, data-model.md §2) — with its own field set.
 *
 * ## Fields, checked against `schema.prisma`, not guessed
 *
 * `IndicatorDefinition` (schema.prisma `model IndicatorDefinition`):
 * `code`/`metricKey`/`name`/`description`/`ownerUserId`/
 * `thresholdComparator`/`thresholdValue`/`isActive` are every field a
 * future `CreateIndicatorDefinitionUseCase`/edit/deactivate use case (Fase
 * 3, out of THIS task's scope) could ever write. `createdByUserId`/
 * `createdAt`/`updatedAt` are deliberately excluded — the same exclusion
 * `compliance-audit-allowlist.ts` applies to `Requirement.createdByUserId`
 * above: set once at creation by the framework, never part of any use
 * case's audited diff, and the audit ROW's own timestamp already carries
 * "when". None of the write use cases exist yet — this registration only
 * needs to EXIST so `AuditRecorder.record(...)` does not throw
 * `AuditFieldAllowlistNotRegisteredError` the moment one does, and so
 * `test/unit/audit-field-allowlist.spec.ts`'s exhaustiveness check (every
 * `AuditEntityType` value has SOME safe registration) passes again now
 * that the enum has grown by three values (T003).
 *
 * `IndicatorMeasurement` (schema.prisma `model IndicatorMeasurement`):
 * `metricKey`/`value`/`valueByBucket`/`breached`/`computedByUserId` —
 * every field `POST /indicators/{metricKey}/measurements` (FR-011, Fase 4)
 * will ever write, since the table is INSERT-only (data-model.md §2 — no
 * `updatedAt` column exists at all). `computedAt` is deliberately
 * excluded, the same reasoning `INCIDENT_RISK_LINK`'s own allow-list
 * (below, in `incident-audit-allowlist.ts`) already applies to its own
 * `linkedAt`: a creation timestamp the audit row's own `createdAt` already
 * subsumes, not a business fact this table's own diff needs to restate.
 */
import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

/** Idempotent — safe to call more than once in the same process, exactly
 * like `registerIncidentAuditAllowlists`. */
export function registerIndicatorAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.INDICATOR, [
    'code',
    'metricKey',
    'name',
    'description',
    'ownerUserId',
    'thresholdComparator',
    'thresholdValue',
    'isActive',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.INDICATOR_MEASUREMENT, [
    'metricKey',
    'value',
    'valueByBucket',
    'breached',
    'computedByUserId',
  ]);
}

/** Test-only escape hatch, mirroring
 * `__resetIncidentAuditAllowlistRegistrationForTests`'s own convention —
 * never called by application code. */
export function __resetIndicatorAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
