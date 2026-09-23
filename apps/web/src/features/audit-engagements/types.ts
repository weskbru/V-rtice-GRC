import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@/lib/messages/findings';

export type { FindingCategory, FindingOrigin, FindingPriority, FindingSeverity, FindingStatus };

export type AuditEngagementStatus = 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type SortDirection = 'asc' | 'desc';

export type AuditEngagementListSortField = 'code' | 'periodStart' | 'updatedAt';

export type AuditScopeTargetType = 'FRAMEWORK_VERSION' | 'REQUIREMENT' | 'CONTROL';

export interface UserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface OrgUnitRef {
  readonly id: string;
  readonly name: string;
}

export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface AuditEngagement {
  readonly id: string;
  readonly code: string;
  objective: string;
  periodStart: string;
  periodEnd: string;
  readonly orgUnit: OrgUnitRef;
  readonly leadAuditor: UserRef;
  readonly status: AuditEngagementStatus;
  readonly startedAt: string | null;
  readonly startedBy: UserRef | null;
  readonly completedAt: string | null;
  readonly completedBy: UserRef | null;
  readonly cancelledAt: string | null;
  readonly cancelledBy: UserRef | null;
  readonly cancellationJustification: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAuditEngagementRequest {
  objective: string;
  periodStart: string;
  periodEnd: string;
  orgUnitId: string;
  leadAuditorUserId: string;
}

export interface UpdateAuditEngagementRequest {
  objective?: string;
  periodStart?: string;
  periodEnd?: string;
  orgUnitId?: string;
  leadAuditorUserId?: string;
}

export interface CancelAuditEngagementRequest {
  justification: string;
}

export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

export interface AuditEngagementListQuery {
  page: number;
  pageSize: number;
  status?: AuditEngagementStatus;
  orgUnitId?: string;
  leadAuditorUserId?: string;
  sort?: AuditEngagementListSortField;
  direction?: SortDirection;
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

export interface RegistrySearchResult<T> {
  readonly data: readonly T[];
  readonly isPartial: boolean;
}

export interface AuditScopeTargetRef {
  readonly id: string;
  readonly label: string;
}

export interface AuditScopeEntry {
  readonly id: string;
  readonly targetType: AuditScopeTargetType;
  readonly target: AuditScopeTargetRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
}

export interface AddFrameworkVersionScopeRequest {
  frameworkVersionId: string;
}

export interface AddRequirementScopeRequest {
  requirementId: string;
}

export interface AddControlScopeRequest {
  controlId: string;
}

export interface FindingSummary {
  readonly id: string;
  readonly code: string;
  title: string;
  description?: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRef;
  readonly status: FindingStatus;
  readonly auditEngagementId: string | null;
  identifiedOn: string;
  readonly createdAt: string;
}

export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

export interface FrameworkRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FrameworkVersionOption {
  readonly id: string;
  readonly label: string;
}

export interface RequirementOption {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
}

export interface AuditEngagementFindingsQuery {
  page: number;
  pageSize: number;
  status?: FindingStatus;
}

export interface CreateFindingFromEngagementRequest {
  title: string;
  description: string;
  recommendation?: string;
  category: FindingCategory;
  origin: FindingOrigin;
  severity: FindingSeverity;
  priority: FindingPriority;
  ownerUserId: string;
  identifiedOn: string;
}
