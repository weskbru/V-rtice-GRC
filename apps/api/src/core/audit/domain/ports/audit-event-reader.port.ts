/**
 * T168/US7 — port for reading `audit_event` (ADR-005). Distinct from
 * `AuditEventWriterPort` (`audit-event-writer.port.ts`) — that port's own
 * header states "there is no per-module audit table or code path" for
 * WRITES; this one is the equivalent single reusable path for READS,
 * consumed today by Risk Management's audit-trail endpoint
 * (`modules/risk/presentation/audit.controller.ts`) and, per ADR-011's
 * extension-point convention, reusable by any future module without
 * editing `core/audit/**`.
 *
 * `AuditQueryService` (`application/audit-query.service.ts`) depends on
 * this abstract class, never on `PrismaService` directly.
 * `PrismaAuditEventReader` (`infrastructure/prisma-audit-event-reader.ts`)
 * is the only implementation, wired in `audit.module.ts`.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuditEntityType, AuditOutcome } from '@prisma/client';

export interface AuditEntityRef {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
}

export interface AuditEventActorRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface AuditEventSummary {
  readonly id: string;
  readonly occurredAt: Date;
  /** Live-resolved from `actorUserId`, `null` only for pre-authentication
   * events (`contracts/risks.openapi.yaml`'s `AuditEvent.actor`) — distinct
   * from `actorLabel` below, which is the DENORMALIZED name captured at
   * write time so history still reads correctly after a rename. */
  readonly actor: AuditEventActorRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string | null;
  /** Already allow-listed at WRITE time (`applyAuditFieldAllowlist`,
   * ADR-005/FR-035) — this reader never applies its own filtering, it only
   * returns what was persisted. */
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}

export interface AuditEventPage {
  readonly items: readonly AuditEventSummary[];
  readonly total: number;
}

export interface AuditEventQuery {
  /** OR-ed together: a row matches if it matches ANY of these
   * `(entityType, entityId)` pairs. Never empty — a caller with nothing to
   * ask about should not call this port at all. */
  readonly entityRefs: readonly AuditEntityRef[];
  readonly action?: string | undefined;
  readonly actorUserId?: string | undefined;
  readonly occurredFrom?: Date | undefined;
  readonly occurredTo?: Date | undefined;
  /** ADR-004 — required, never optional (same convention as
   * `ScopedRepository`/`RiskQueryPort`): every read of `audit_event` is
   * organizationally scoped, applied against its own `organizationalUnitId`
   * column. */
  readonly scope: ScopeFilter;
  readonly page: number;
  readonly pageSize: number;
}

export abstract class AuditEventReaderPort {
  abstract query(input: AuditEventQuery): Promise<AuditEventPage>;
}
