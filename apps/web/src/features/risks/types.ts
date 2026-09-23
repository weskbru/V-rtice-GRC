export type RiskStatus =
  | 'DRAFT'
  | 'IDENTIFIED'
  | 'ASSESSED'
  | 'UNDER_TREATMENT'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'CLOSED'
  | 'ARCHIVED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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

export interface ReferenceDataRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ReferenceDataItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

export interface RiskStatement {
  readonly id: string;
  readonly description: string;
  readonly sortOrder: number;
}

export interface RiskSummary {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly descriptionExcerpt: string | null;
  readonly status: RiskStatus;
  readonly category?: ReferenceDataRef;
  readonly orgUnit: OrgUnitRef;
  readonly owner: UserRef;
  readonly responsible?: UserRef;
  readonly inherentScore?: number;
  readonly inherentLevel?: RiskLevel;
  readonly residualScore?: number;
  readonly residualLevel?: RiskLevel;
  readonly lastAssessedOn?: string;
  readonly nextReviewOn?: string;
  readonly overdueReview: boolean;
  readonly overdueTreatment: boolean;
  readonly pendingApproval: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

export interface RiskDetail extends RiskSummary {
  readonly description: string;
  readonly type: ReferenceDataRef | null;
  readonly origin: ReferenceDataRef | null;
  readonly causes: readonly RiskStatement[];
  readonly consequences: readonly RiskStatement[];
  readonly currentAssessment: RiskAssessment | null;
  readonly currentTreatment: RiskTreatmentDecision | null;
  readonly controls: readonly RiskControlLink[];
  readonly processes: readonly RiskEntityLink[];
  readonly assets: readonly RiskEntityLink[];
  readonly treatmentActionSummary: TreatmentActionSummary;
  readonly identifiedOn: string;
  readonly archivedAt: string | null;
  readonly createdAt: string;
}

export type TreatmentStrategy = 'MITIGATE' | 'ACCEPT' | 'TRANSFER' | 'AVOID';

export type TreatmentActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface TreatmentActionSummary {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export interface RiskTreatmentDecision {
  readonly id: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: string | null;
  readonly decidedBy: UserRef;
  readonly decidedAt: string;
  readonly supersededAt: string | null;
  readonly deadlineOverdue: boolean;
}

export interface CreateRiskTreatmentDecisionRequest {
  strategy: TreatmentStrategy;
  description: string;
  deadline?: string | null;
}

export interface RiskTreatmentAction {
  readonly id: string;
  readonly treatmentDecisionId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRef;
  readonly dueOn: string;
  readonly status: TreatmentActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface CreateRiskTreatmentActionRequest {
  title: string;
  description?: string | null;
  responsibleUserId: string;
  dueOn: string;
  treatmentDecisionId?: string | null;
}

export interface UpdateRiskTreatmentActionRequest {
  title?: string;
  description?: string | null;
  responsibleUserId?: string;
  dueOn?: string;
  status?: TreatmentActionStatus;
  reopenReason?: string;
}

export interface RegistryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export type CollaborationEntityType = 'RISK' | 'EVIDENCE' | 'INCIDENT' | 'PROBLEM';

export interface Comment {
  readonly id: string;
  readonly entityType: CollaborationEntityType;
  readonly entityId: string;
  readonly body: string;
  readonly author: UserRef;
  readonly createdAt: string;
}

export interface Attachment {
  readonly id: string;
  readonly entityType: CollaborationEntityType;
  readonly entityId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: UserRef;
  readonly createdAt: string;
  readonly contentUrl: string;
}

export interface RiskControlLink {
  readonly id: string;
  readonly control: ReferenceDataRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRef | null;
  readonly unlinkedAt: string | null;
}

export interface RiskEntityLink {
  readonly id: string;
  readonly entity: ReferenceDataRef;
  readonly linkedBy: UserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface LinkEntityRequest {
  id: string;
}

export interface ControlRef {
  readonly id: string;
  readonly code?: string;
  readonly name?: string;
}

export interface AssessmentLevelChange {
  readonly previousInherentLevel: RiskLevel | null;
  readonly previousResidualLevel: RiskLevel | null;
  readonly direction: 'INCREASED' | 'DECREASED' | 'UNCHANGED' | null;
}

export interface RiskAssessment {
  readonly id: string;
  readonly assessedBy: UserRef;
  readonly assessedOn: string;
  readonly methodologyVersion: { readonly id: string; readonly versionNumber: number };
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevel;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevel;
  readonly controlsConsidered: readonly ControlRef[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
  readonly levelChange: AssessmentLevelChange;
}

export interface CreateRiskAssessmentRequest {
  assessedOn?: string;
  inherentProbability: number;
  inherentImpact: number;
  residualProbability: number;
  residualImpact: number;
  controlIdsConsidered?: readonly string[];
  rationale?: string | null;
  methodologyVersionId?: string | null;
  nextReviewOn?: string | null;
}

export interface ScalePoint {
  readonly value: number;
  readonly label: string;
  readonly description?: string | null;
}

export interface MethodologyMatrixCell {
  readonly probability: number;
  readonly impact: number;
  readonly score: number;
  readonly level: RiskLevel;
}

export interface LevelBand {
  readonly level: RiskLevel;
  readonly minScore: number;
  readonly maxScore: number;
}

export interface RiskMethodologyVersion {
  readonly id: string;
  readonly methodologyName: string;
  readonly versionNumber: number;
  readonly probabilityScale: readonly ScalePoint[];
  readonly impactScale: readonly ScalePoint[];
  readonly matrix: readonly MethodologyMatrixCell[];
  readonly levelBands: readonly LevelBand[];
  readonly effectiveFrom: string;
  readonly isActive: boolean;
  readonly createdBy: UserRef;
}

export interface CreateRiskRequest {
  title: string;
  description: string;
  categoryId?: string | null;
  typeId?: string | null;
  originId?: string | null;
  orgUnitId: string;
  ownerUserId: string;
  responsibleUserId?: string | null;
  identifiedOn?: string;
  nextReviewOn?: string | null;
  causes?: readonly string[];
  consequences?: readonly string[];
}

export interface UpdateRiskRequest {
  title?: string;
  description?: string;
  categoryId?: string | null;
  typeId?: string | null;
  originId?: string | null;
  orgUnitId?: string;
  ownerUserId?: string;
  responsibleUserId?: string | null;
  identifiedOn?: string;
  nextReviewOn?: string | null;
}

export interface ReplaceRiskStatementsRequest {
  items: readonly string[];
}

export interface Approval {
  readonly id: string;
  readonly requestedTransition: string;
  readonly requestedBy: UserRef;
  readonly requestedAt: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly decidedBy: UserRef | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

export interface AvailableRiskTransition {
  readonly toStatus: RiskStatus;
  readonly requiredPermission: string;
  readonly requiresApproval: boolean;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions?: readonly string[];
}

export interface RiskLifecycleState {
  readonly status: RiskStatus;
  readonly pendingApproval: Approval | null;
  readonly availableTransitions: readonly AvailableRiskTransition[];
  readonly traversedStatuses: readonly RiskStatus[];
}

export interface TransitionRiskRequest {
  toStatus: RiskStatus;
  justification?: string;
}

export interface RiskLifecycleTransition {
  readonly id: string;
  readonly fromStatus: RiskStatus;
  readonly toStatus: RiskStatus;
  readonly performedBy: UserRef;
  readonly performedAt: string;
  readonly justification: string | null;
  readonly approvalId: string | null;
}

export interface RequestApprovalRequest {
  toStatus: 'ACCEPTED' | 'CLOSED';
  justification?: string;
}

export interface ApprovalDecisionRequest {
  decision: 'APPROVED' | 'REJECTED';
  justification?: string;
}

export interface VersionConflictProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  currentVersion: number;
  currentStatus: RiskStatus;
  modifiedAt?: string;
  modifiedBy?: UserRef;
}

export type RiskRegisterSortField =
  | 'code'
  | 'title'
  | 'riskLevel'
  | 'status'
  | 'owner'
  | 'nextReviewOn'
  | 'identifiedOn'
  | 'updatedAt';

export type SortDirection = 'asc' | 'desc';

export type RiskLevelBasis = 'RESIDUAL' | 'INHERENT';

export interface RiskRegisterQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: readonly RiskStatus[];
  riskLevel?: readonly RiskLevel[];
  riskLevelBasis?: RiskLevelBasis;
  categoryId?: readonly string[];
  orgUnitId?: readonly string[];
  includeDescendants?: boolean;
  ownerUserId?: readonly string[];
  overdueReview?: boolean;
  overdueTreatment?: boolean;
  sort?: RiskRegisterSortField;
  direction?: SortDirection;
}

export type RiskHistoryEntryType =
  | 'ASSESSMENT'
  | 'LEVEL_CHANGE'
  | 'OWNERSHIP_CHANGE'
  | 'TREATMENT_DECISION'
  | 'TREATMENT_ACTION'
  | 'CONTROL_LINK'
  | 'LIFECYCLE_TRANSITION'
  | 'APPROVAL'
  | 'FIELD_CHANGE';

export interface RiskHistoryEntry {
  readonly id: string;
  readonly type: RiskHistoryEntryType;
  readonly occurredAt: string;
  readonly assessedOn: string | null;
  readonly actor: UserRef;
  readonly summary: string;
  readonly previousValue: string | null;
  readonly newValue: string | null;
  readonly referenceId: string | null;
}

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actor: UserRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
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

export type IncidentStatusRef = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type ProblemStatusRef = 'OPEN' | 'IN_ANALYSIS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface IncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatusRef;
}

export interface ProblemRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatusRef;
}

export interface LinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface RiskIncidentLink {
  readonly id: string;
  readonly incident: IncidentRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface RiskProblemLink {
  readonly id: string;
  readonly problem: ProblemRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}
