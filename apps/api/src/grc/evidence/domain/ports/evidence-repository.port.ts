import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  EvidenceSource,
  EvidenceStatus,
  EvidenceSubjectType,
  EvidenceType,
} from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface EvidenceRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string | undefined;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly owner: UserRefRecord;
  readonly collectedOn: Date;
  readonly validUntil: Date | undefined;
  readonly status: EvidenceStatus;
  readonly externalUrl: string | undefined;
  readonly observation: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly archivedByUserId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateEvidenceRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly ownerUserId: string;
  readonly collectedOn: Date;
  readonly validUntil: Date | undefined;
  readonly externalUrl: string | undefined;
  readonly observation: string | undefined;
}

export interface UpdateEvidenceChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly type?: EvidenceType;
  readonly source?: EvidenceSource;
  readonly ownerUserId?: string;
  readonly collectedOn?: Date;
  readonly validUntil?: Date | null;
  readonly externalUrl?: string | null;
  readonly observation?: string | null;
}

export interface EvidenceListFilter {
  readonly status?: EvidenceStatus | undefined;
  readonly type?: EvidenceType | undefined;
  readonly ownerUserId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly expiringBefore?: Date | undefined;
  readonly search?: string | undefined;
  readonly subjectType?: EvidenceSubjectType | undefined;
  readonly subjectId?: string | undefined;
}

export interface EvidencePageResult {
  readonly items: readonly EvidenceRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class EvidenceRepositoryPort {
  abstract create(input: CreateEvidenceRecordInput): Promise<EvidenceRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<EvidenceRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateEvidenceChanges,
  ): Promise<EvidenceRecord | undefined>;

  abstract archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<EvidenceRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: EvidenceListFilter,
    page: number,
    pageSize: number,
  ): Promise<EvidencePageResult>;
}
