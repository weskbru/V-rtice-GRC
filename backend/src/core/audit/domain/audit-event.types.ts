import type { AuditEntityType, AuditOutcome } from '@prisma/client';

export interface AuditRequestContextSnapshot {
  readonly actorUserId?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly correlationId?: string | undefined;
}

export interface AuditEventRecord {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorUserId?: string | undefined;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: AuditEntityType;
  readonly entityId?: string | undefined;
  readonly previousValues?: Record<string, unknown> | undefined;
  readonly newValues?: Record<string, unknown> | undefined;
  readonly organizationalUnitId?: string | undefined;
  readonly ipAddress?: string | undefined;
  readonly userAgent?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly correlationId: string;
  readonly outcome: AuditOutcome;
}

export interface RecordAuditEventInput {
  readonly action: string;
  readonly entityType: AuditEntityType;
  readonly actorLabel: string;
  readonly entityId?: string | undefined;
  readonly previousValues?: Readonly<Record<string, unknown>> | undefined;
  readonly newValues?: Readonly<Record<string, unknown>> | undefined;
  readonly organizationalUnitId?: string | undefined;
  readonly outcome?: AuditOutcome | undefined;
}
