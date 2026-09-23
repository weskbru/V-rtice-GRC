import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly reportedBy: UserRefRecord;
  readonly owner: UserRefRecord;
  readonly reportedOn: Date;
  readonly resolutionSummary: string | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolvedBy: UserRefRecord | undefined;
  readonly closedAt: Date | undefined;
  readonly closedBy: UserRefRecord | undefined;
  readonly cancellationReason: string | undefined;
  readonly cancelledAt: Date | undefined;
  readonly cancelledBy: UserRefRecord | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateIncidentRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly severity: IncidentSeverity;
  readonly reportedByUserId: string;
  readonly ownerUserId: string;
  readonly reportedOn: Date;
}

export interface UpdateIncidentChanges {
  readonly title?: string;
  readonly description?: string;
  readonly severity?: IncidentSeverity;
  readonly ownerUserId?: string;
}

export interface IncidentTransitionChanges {
  readonly status: IncidentStatus;
  readonly resolutionSummary: string | null;
  readonly resolvedAt: Date | null;
  readonly resolvedByUserId: string | null;
  readonly closedAt: Date | null;
  readonly closedByUserId: string | null;
  readonly cancellationReason: string | null;
  readonly cancelledAt: Date | null;
  readonly cancelledByUserId: string | null;
}

export interface IncidentListFilter {
  readonly status?: readonly IncidentStatus[] | undefined;
  readonly severity?: readonly IncidentSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

export type IncidentSortField =
  'code' | 'title' | 'severity' | 'status' | 'reportedOn' | 'updatedAt';

export interface IncidentPageResult {
  readonly items: readonly IncidentRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class IncidentRepositoryPort {
  abstract create(input: CreateIncidentRecordInput): Promise<IncidentRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<IncidentRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateIncidentChanges,
  ): Promise<IncidentRecord | undefined>;

  abstract transition(
    scope: ScopeFilter,
    id: string,
    changes: IncidentTransitionChanges,
  ): Promise<IncidentRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: IncidentListFilter,
    sort: IncidentSortField,
    direction: 'asc' | 'desc',
    page: number,
    pageSize: number,
  ): Promise<IncidentPageResult>;
}
