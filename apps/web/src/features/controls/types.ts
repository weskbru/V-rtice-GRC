export type ControlStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export type ControlNature = 'MANUAL' | 'AUTOMATED';

export type ControlType = 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE';

export type ControlFrequency =
  'CONTINUOUS' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

export type ControlAssessmentResult = 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE';

export type ControlEffectiveness =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

export type AttestationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SortDirection = 'asc' | 'desc';

export type ControlRegisterSortField =
  'code' | 'name' | 'status' | 'effectiveness' | 'owner' | 'updatedAt';

export interface UserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email?: string;
}

export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface EntityRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

export interface ControlSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: OrgUnitRef | null;
  readonly owner: UserRef | null;
  readonly nature: ControlNature | null;
  readonly type: ControlType | null;
  readonly frequency: ControlFrequency | null;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ControlDetail extends ControlSummary {
  readonly description: string;
  readonly retiredAt: string | null;
  readonly retiredBy: UserRef | null;
  readonly retirementReason: string | null;
  readonly createdAt: string;
}

export interface CreateControlRequest {
  name: string;
  description: string;
  orgUnitId: string;
  ownerUserId?: string | null;
  nature?: ControlNature | null;
  type?: ControlType | null;
  frequency?: ControlFrequency | null;
}

export interface UpdateControlRequest {
  name?: string;
  description?: string;
  orgUnitId?: string;
  ownerUserId?: string | null;
  nature?: ControlNature | null;
  type?: ControlType | null;
  frequency?: ControlFrequency | null;
}

export interface AvailableControlTransition {
  readonly toStatus: ControlStatus;
  readonly requiredPermission: string;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions?: readonly string[];
}

export interface ControlLifecycleState {
  readonly status: ControlStatus;
  readonly availableTransitions: readonly AvailableControlTransition[];
}

export interface TransitionControlRequest {
  toStatus: ControlStatus;
  justification?: string;
}

export interface ControlLifecycleTransition {
  readonly id: string;
  readonly fromStatus: ControlStatus;
  readonly toStatus: ControlStatus;
  readonly performedBy: UserRef;
  readonly performedAt: string;
  readonly justification: string | null;
}

export interface ControlAssessmentAttestation {
  readonly id: string;
  readonly status: AttestationStatus;
  readonly requestedBy: UserRef;
  readonly requestedAt: string;
  readonly decidedBy: UserRef | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

export interface ControlAssessment {
  readonly id: string;
  readonly assessedOn: string;
  readonly assessor: UserRef;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
  readonly attestation: ControlAssessmentAttestation | null;
  readonly createdAt: string;
}

export interface CreateControlAssessmentRequest {
  assessedOn: string;
  result: ControlAssessmentResult;
  conclusion: string;
}

export interface ControlAssessmentAttestationDecisionRequest {
  decision: 'APPROVED' | 'REJECTED';
  justification?: string;
}

interface RelationshipLinkBase {
  readonly id: string;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

export interface ControlProcessLink extends RelationshipLinkBase {
  readonly process: EntityRef;
}

export interface ControlAssetLink extends RelationshipLinkBase {
  readonly asset: EntityRef;
}

export interface ControlRiskLink extends RelationshipLinkBase {
  readonly risk: RiskRef;
}

export interface LinkEntityRequest {
  id: string;
}

export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  currentStatus: ControlStatus;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

export interface ControlRegisterQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: readonly ControlStatus[];
  effectiveness?: readonly ControlEffectiveness[];
  nature?: readonly ControlNature[];
  type?: readonly ControlType[];
  frequency?: readonly ControlFrequency[];
  orgUnitId?: readonly string[];
  ownerUserId?: readonly string[];
  sort?: ControlRegisterSortField;
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

export interface RegistryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}
