import type {
  OrgUnitRefRecord,
  ReferenceDataRefRecord,
  UserRefRecord,
} from './risk-repository.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RiskLevel, RiskStatus } from '@prisma/client';

export type RiskLevelBasis = 'RESIDUAL' | 'INHERENT';

export type RiskRegisterSortField =
  | 'code'
  | 'title'
  | 'riskLevel'
  | 'status'
  | 'owner'
  | 'nextReviewOn'
  | 'identifiedOn'
  | 'updatedAt';

export type RiskRegisterSortDirection = 'asc' | 'desc';

export interface RiskRegisterFilters {
  readonly q?: string | undefined;
  readonly status?: readonly RiskStatus[] | undefined;
  readonly riskLevel?: readonly RiskLevel[] | undefined;
  readonly riskLevelBasis: RiskLevelBasis;
  readonly categoryId?: readonly string[] | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly includeDescendants: boolean;
  readonly ownerUserId?: readonly string[] | undefined;
  readonly overdueReview?: boolean | undefined;
  readonly overdueTreatment?: boolean | undefined;
}

export interface RiskRegisterSort {
  readonly field: RiskRegisterSortField;
  readonly direction: RiskRegisterSortDirection;
}

export interface RiskRegisterQuery {
  readonly scope: ScopeFilter;
  readonly filters: RiskRegisterFilters;
  readonly sort: RiskRegisterSort;
  readonly page: number;
  readonly pageSize: number;
}

export interface RiskRegisterRow {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly descriptionExcerpt: string | null;
  readonly status: RiskStatus;
  readonly category: ReferenceDataRefRecord | undefined;
  readonly orgUnit: OrgUnitRefRecord;
  readonly owner: UserRefRecord;
  readonly responsible: UserRefRecord | undefined;
  readonly inherentScore: number | undefined;
  readonly inherentLevel: RiskLevel | undefined;
  readonly residualScore: number | undefined;
  readonly residualLevel: RiskLevel | undefined;
  readonly lastAssessedOn: Date | undefined;
  readonly nextReviewOn: Date | undefined;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly updatedAt: Date;
}

export interface RiskRegisterPage {
  readonly items: readonly RiskRegisterRow[];
  readonly total: number;
}

export abstract class RiskQueryPort {
  abstract listRegister(query: RiskRegisterQuery): Promise<RiskRegisterPage>;
}
