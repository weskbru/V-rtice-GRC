import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuditEngagementStatus } from '@prisma/client';

export interface AuditEngagementOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AuditEngagementUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface AuditEngagementRecord {
  readonly id: string;
  readonly code: string;
  readonly objective: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly orgUnit: AuditEngagementOrgUnitRefRecord;
  readonly leadAuditor: AuditEngagementUserRefRecord;
  readonly status: AuditEngagementStatus;
  readonly startedAt: Date | undefined;
  readonly startedBy: AuditEngagementUserRefRecord | undefined;
  readonly completedAt: Date | undefined;
  readonly completedBy: AuditEngagementUserRefRecord | undefined;
  readonly cancelledAt: Date | undefined;
  readonly cancelledBy: AuditEngagementUserRefRecord | undefined;
  readonly cancellationJustification: string | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAuditEngagementRecordInput {
  readonly code: string;
  readonly objective: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly orgUnitId: string;
  readonly leadAuditorUserId: string;
}

export interface UpdateAuditEngagementChanges {
  readonly objective?: string;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly orgUnitId?: string;
  readonly leadAuditorUserId?: string;
}

export interface ApplyAuditEngagementTransitionChanges {
  readonly status: AuditEngagementStatus;
  readonly startedAt?: Date;
  readonly startedByUserId?: string;
  readonly completedAt?: Date;
  readonly completedByUserId?: string;
  readonly cancelledAt?: Date;
  readonly cancelledByUserId?: string;
  readonly cancellationJustification?: string;
}

export type AuditEngagementUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: AuditEngagementRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: AuditEngagementStatus;
    };

export interface AuditEngagementListFilters {
  readonly status?: readonly AuditEngagementStatus[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly leadAuditorUserId?: readonly string[] | undefined;
}

export type AuditEngagementListSortField = 'code' | 'periodStart' | 'updatedAt';
export type AuditEngagementListSortDirection = 'asc' | 'desc';

export interface AuditEngagementListQuery {
  readonly scope: ScopeFilter;
  readonly filters: AuditEngagementListFilters;
  readonly sortField: AuditEngagementListSortField;
  readonly sortDirection: AuditEngagementListSortDirection;
  readonly page: number;
  readonly pageSize: number;
}

export interface AuditEngagementListPage {
  readonly items: readonly AuditEngagementRecord[];
  readonly total: number;
}

export abstract class AuditEngagementRepositoryPort {
  abstract create(input: CreateAuditEngagementRecordInput): Promise<AuditEngagementRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<AuditEngagementRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract list(query: AuditEngagementListQuery): Promise<AuditEngagementListPage>;

  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateAuditEngagementChanges,
  ): Promise<AuditEngagementUpdateResult>;

  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyAuditEngagementTransitionChanges,
  ): Promise<AuditEngagementUpdateResult>;
}
