import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface FindingRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRefRecord;
  readonly identifiedOn: Date;
  readonly status: FindingStatus;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: Date | undefined;
  readonly closedByUserId: string | undefined;
  readonly closureJustification: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly archivedByUserId: string | undefined;
  readonly auditEngagementId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateFindingRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | undefined;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: Date;
  readonly auditEngagementId?: string | undefined;
}

export interface UpdateFindingChanges {
  readonly title?: string;
  readonly description?: string;
  readonly recommendation?: string | null;
  readonly category?: FindingCategory;
  readonly severity?: FindingSeverity;
  readonly priority?: FindingPriority;
  readonly ownerUserId?: string;
}

export interface CloseFindingChanges {
  readonly closedAt: Date;
  readonly closedByUserId: string;
  readonly closureJustification: string | null;
}

export interface FindingListFilter {
  readonly status?: FindingStatus | undefined;
  readonly severity?: FindingSeverity | undefined;
  readonly ownerUserId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly withoutRemediation?: boolean | undefined;
  readonly auditEngagementId?: string | undefined;
}

export interface FindingPageResult {
  readonly items: readonly FindingRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class FindingRepositoryPort {
  abstract create(input: CreateFindingRecordInput): Promise<FindingRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract listIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateFindingChanges,
  ): Promise<FindingRecord | undefined>;

  abstract close(
    scope: ScopeFilter,
    id: string,
    changes: CloseFindingChanges,
  ): Promise<FindingRecord | undefined>;

  abstract reopen(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  abstract startRemediation(scope: ScopeFilter, id: string): Promise<FindingRecord | undefined>;

  abstract archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<FindingRecord | undefined>;

  abstract findCompletedLinkedActionResponsibles(findingId: string): Promise<readonly string[]>;

  abstract list(
    scope: ScopeFilter,
    filter: FindingListFilter,
    page: number,
    pageSize: number,
  ): Promise<FindingPageResult>;
}
