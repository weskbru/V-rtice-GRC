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
  readonly actor: AuditEventActorRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: AuditEntityType;
  readonly entityId: string | null;
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
  readonly entityRefs: readonly AuditEntityRef[];
  readonly action?: string | undefined;
  readonly actorUserId?: string | undefined;
  readonly occurredFrom?: Date | undefined;
  readonly occurredTo?: Date | undefined;
  readonly scope: ScopeFilter;
  readonly page: number;
  readonly pageSize: number;
}

export abstract class AuditEventReaderPort {
  abstract query(input: AuditEventQuery): Promise<AuditEventPage>;
}
