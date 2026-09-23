import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

export interface ProblemOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProblemUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProblemSeverity;
  readonly status: ProblemStatus;
  readonly orgUnit: ProblemOrgUnitRefRecord;
  readonly owner: ProblemUserRefRecord;
  readonly identifiedOn: Date;
  readonly rootCause: string | undefined;
  readonly resolvedAt: Date | undefined;
  readonly resolvedBy: ProblemUserRefRecord | undefined;
  readonly closedAt: Date | undefined;
  readonly closedBy: ProblemUserRefRecord | undefined;
  readonly cancellationReason: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateProblemRecordInput {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProblemSeverity;
  readonly orgUnitId: string;
  readonly ownerUserId: string;
  readonly identifiedOn: Date;
}

export interface UpdateProblemChanges {
  readonly title?: string;
  readonly description?: string;
  readonly severity?: ProblemSeverity;
  readonly ownerUserId?: string;
}

export interface ApplyProblemTransitionChanges {
  readonly status: ProblemStatus;
  readonly rootCause?: string | null;
  readonly resolvedAt?: Date | null;
  readonly resolvedByUserId?: string | null;
  readonly closedAt?: Date | null;
  readonly closedByUserId?: string | null;
  readonly cancellationReason?: string | null;
  readonly cancelledAt?: Date | null;
  readonly cancelledByUserId?: string | null;
}

export interface ProblemListFilter {
  readonly status?: readonly ProblemStatus[] | undefined;
  readonly severity?: readonly ProblemSeverity[] | undefined;
  readonly search?: string | undefined;
  readonly orgUnitId?: string | undefined;
}

export type ProblemListSortField =
  'code' | 'title' | 'severity' | 'status' | 'identifiedOn' | 'updatedAt';

export interface ProblemListPage {
  readonly items: readonly ProblemRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export abstract class ProblemRepositoryPort {
  abstract create(input: CreateProblemRecordInput): Promise<ProblemRecord>;

  abstract findById(scope: ScopeFilter, id: string): Promise<ProblemRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateProblemChanges,
  ): Promise<ProblemRecord | undefined>;

  abstract applyTransition(
    scope: ScopeFilter,
    id: string,
    changes: ApplyProblemTransitionChanges,
  ): Promise<ProblemRecord | undefined>;

  abstract findCompletedOriginActionCompleters(problemId: string): Promise<readonly string[]>;

  abstract list(
    scope: ScopeFilter,
    filter: ProblemListFilter,
    page: number,
    pageSize: number,
    sort: ProblemListSortField,
    direction: 'asc' | 'desc',
  ): Promise<ProblemListPage>;
}
