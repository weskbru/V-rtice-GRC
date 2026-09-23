import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ActionOriginType, ActionStatus } from '@prisma/client';

export type ActionOriginScopeRestriction =
  | { readonly kind: 'UNRESTRICTED' }
  | {
      readonly kind: 'RESTRICTED';
      readonly allowedOriginIdsByType: ReadonlyMap<ActionOriginType, readonly string[]>;
    };

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface ActionRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly responsible: UserRefRecord;
  readonly dueOn: Date;
  readonly status: ActionStatus;
  readonly completedAt: Date | undefined;
  readonly completedByUserId: string | undefined;
  readonly reopenedAt: Date | undefined;
  readonly reopenedByUserId: string | undefined;
  readonly reopenReason: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateActionRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly responsibleUserId: string;
  readonly dueOn: Date;
}

export interface UpdateActionChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly responsibleUserId?: string;
  readonly dueOn?: Date;
}

export interface ActionTransitionChanges {
  readonly status: ActionStatus;
  readonly completedAt: Date | null;
  readonly completedByUserId: string | null;
  readonly reopenedAt: Date | null;
  readonly reopenedByUserId: string | null;
  readonly reopenReason: string | null;
}

export interface ActionListFilter {
  readonly status?: ActionStatus | undefined;
  readonly statuses?: readonly ActionStatus[] | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly originType?: ActionOriginType | undefined;
  readonly originId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly overdue?: boolean | undefined;
  readonly dueBefore?: Date | undefined;
}

export interface ActionPageResult {
  readonly items: readonly ActionRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class ActionRepositoryPort {
  abstract create(input: CreateActionRecordInput): Promise<ActionRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<ActionRecord | undefined>;

  abstract findByIdUnscoped(id: string): Promise<ActionRecord | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined>;

  abstract transition(
    scope: ScopeFilter,
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined>;

  abstract mirrorTransition(
    id: string,
    changes: ActionTransitionChanges,
  ): Promise<ActionRecord | undefined>;

  abstract mirrorFieldUpdate(
    id: string,
    changes: UpdateActionChanges,
  ): Promise<ActionRecord | undefined>;

  abstract list(
    restriction: ActionOriginScopeRestriction,
    filter: ActionListFilter,
    page: number,
    pageSize: number,
  ): Promise<ActionPageResult>;

  abstract countOverdueInScope(scope: ScopeFilter, referenceDate: Date): Promise<number>;

  abstract getStatusBreakdown(scope: ScopeFilter): Promise<Readonly<Record<ActionStatus, number>>>;

  abstract countDueSoonInScope(
    scope: ScopeFilter,
    fromInclusive: Date,
    toExclusive: Date,
  ): Promise<number>;
}
