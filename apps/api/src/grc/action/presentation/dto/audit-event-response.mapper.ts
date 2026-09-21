/**
 * Maps `AuditEventSummary` (`core/audit/domain/ports/audit-event-reader.port.ts`)
 * to `contracts/grc-foundation.openapi.yaml`'s `AuditEvent` wire shape. The
 * ONE place an `Action` audit entry becomes a response body (ADR-009).
 * Never returns any field beyond the contract's declared properties — no
 * secrets, no internal identifiers (CLAUDE.md §12).
 *
 * Duplicated from `modules/risk/presentation/dto/audit-event-response.mapper.ts`
 * rather than imported from it: `grc/**` must never import `modules/**`
 * (ADR-016), and `core/audit` cannot own this mapping either — see D-12
 * (`docs/local-environment.md`) and `action-audit.controller.ts`'s own
 * header for the full reasoning this file's placement follows.
 */
import type { AuditEventSummary } from '../../../../core/audit/domain/ports/audit-event-reader.port';

export interface AuditEventActorResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface AuditEventResponse {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: AuditEventActorResponse | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}

export function toAuditEventResponse(record: AuditEventSummary): AuditEventResponse {
  return {
    id: record.id,
    occurredAt: record.occurredAt.toISOString(),
    actor: record.actor
      ? { id: record.actor.id, fullName: record.actor.fullName, email: record.actor.email }
      : null,
    actorLabel: record.actorLabel,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    previousValues: record.previousValues,
    newValues: record.newValues,
    outcome: record.outcome,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    correlationId: record.correlationId,
  };
}
