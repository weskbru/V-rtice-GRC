export type FrameworkOrigin = 'EXTERNAL_STANDARD' | 'INTERNAL_POLICY';

export type FrameworkVersionStatus = 'DRAFT' | 'PUBLISHED';

export type RequirementComplianceState =
  'NOT_APPLICABLE' | 'NOT_MET' | 'NOT_PROVEN' | 'PARTIALLY_MET' | 'COMPLIANT';

export type SortDirection = 'asc' | 'desc';

export type FrameworkListSortField = 'code' | 'name' | 'updatedAt';

export interface UserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

export interface Framework {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateFrameworkRequest {
  name: string;
  description: string;
  origin: FrameworkOrigin;
}

export interface UpdateFrameworkRequest {
  name?: string;
  description?: string;
  origin?: FrameworkOrigin;
}

export interface FrameworkVersionFrameworkRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FrameworkVersion {
  readonly id: string;
  readonly framework: FrameworkVersionFrameworkRef;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
  readonly publishedAt: string | null;
  readonly publishedBy: UserRef | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateFrameworkVersionRequest {
  label: string;
}

export interface UpdateFrameworkVersionRequest {
  label: string;
}

export interface RequirementFrameworkVersionRef {
  readonly id: string;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
}

export interface RequirementApplicability {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: UserRef;
  readonly declaredAt: string;
  readonly revokedBy: UserRef | null;
  readonly revokedAt: string | null;
}

export interface Requirement {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: RequirementApplicability | null;
  readonly complianceState: RequirementComplianceState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateRequirementRequest {
  externalRef: string;
  title: string;
  description: string;
}

export interface UpdateRequirementRequest {
  externalRef?: string;
  title?: string;
  description?: string;
}

export interface FrameworkListQuery {
  page: number;
  pageSize: number;
  q?: string;
  origin?: readonly FrameworkOrigin[];
  sort?: FrameworkListSortField;
  direction?: SortDirection;
}

export interface FrameworkVersionListQuery {
  page: number;
  pageSize: number;
  status?: readonly FrameworkVersionStatus[];
}

export interface RequirementListQuery {
  page: number;
  pageSize: number;
  complianceState?: readonly RequirementComplianceState[];
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

export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RequirementControlLink {
  readonly id: string;
  readonly control: ControlRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

export interface LinkRequirementControlRequest {
  controlId: string;
}

export interface DeclareApplicabilityRequest {
  justification: string;
}

export interface ComplianceSummary {
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly totalRequirements: number;
  readonly applicableRequirementCount: number;
  readonly counts: {
    readonly notApplicable: number;
    readonly notMet: number;
    readonly notProven: number;
    readonly partiallyMet: number;
    readonly compliant: number;
  };
  readonly compliancePercentage: number | null;
  readonly computedAt: string;
}

export type MappingMigrationOutcome = 'COPIED' | 'PENDING_DECISION' | 'SKIPPED_ALREADY_MAPPED';

export interface MappingMigrationRequirementRef {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
}

export interface MappingMigrationCorrespondence {
  targetRequirementId: string;
  sourceRequirementIds: readonly string[];
}

export interface ExecuteMappingMigrationRequest {
  sourceFrameworkVersionId: string;
  correspondences: readonly MappingMigrationCorrespondence[];
}

export interface MappingMigrationItem {
  readonly targetRequirement: MappingMigrationRequirementRef;
  readonly sourceRequirements: readonly MappingMigrationRequirementRef[];
  readonly outcome: MappingMigrationOutcome;
  readonly copiedLinkCount: number;
}

export interface MappingMigrationSummary {
  readonly id: string;
  readonly sourceFrameworkVersion: RequirementFrameworkVersionRef;
  readonly targetFrameworkVersion: RequirementFrameworkVersionRef;
  readonly executedBy: UserRef;
  readonly executedAt: string;
  readonly itemCount: number;
  readonly copiedCount: number;
  readonly pendingDecisionCount: number;
  readonly skippedAlreadyMappedCount: number;
}

export interface MappingMigrationDetail extends MappingMigrationSummary {
  readonly items: readonly MappingMigrationItem[];
}
