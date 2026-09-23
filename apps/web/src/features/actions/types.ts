import type { ActionOriginType, ActionStatus } from '@/lib/messages/actions';
import type { GrcFoundation } from '@pharos/api-types';

export type { ActionOriginType, ActionStatus };

export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

export type UserRef = GrcFoundation.components['schemas']['UserRef'];

export interface Action {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly originLabel?: string;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRef;
  readonly dueOn: string;
  readonly status: ActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly reopenedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ActionPage {
  readonly items: readonly Action[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface CreateActionRequest {
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description?: string;
  readonly responsibleUserId: string;
  readonly dueOn: string;
}

export interface UpdateActionRequest {
  readonly title?: string;
  readonly description?: string;
  readonly responsibleUserId?: string;
  readonly dueOn?: string;
}

export interface TransitionActionRequest {
  readonly to: ActionStatus;
  readonly reason?: string;
}

export interface ListActionsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ActionStatus;
  readonly responsibleUserId?: string;
  readonly originType?: ActionOriginType;
  readonly originId?: string;
  readonly overdue?: boolean;
}

export interface Page<T> {
  data: readonly T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: UserRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}
