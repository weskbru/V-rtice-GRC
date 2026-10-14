import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@/lib/messages/findings';
import type { GrcFoundation } from '@vertice/api-types';

export type { FindingCategory, FindingOrigin, FindingPriority, FindingSeverity, FindingStatus };

export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

export type UserRef = GrcFoundation.components['schemas']['UserRef'];

export interface Finding {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | null;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRef;
  readonly identifiedOn: string;
  readonly status: FindingStatus;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: string | null;
  readonly closureJustification: string | null;
  readonly auditEngagementId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateFindingRequest {
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation?: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: string;
}

export interface UpdateFindingRequest {
  readonly title?: string;
  readonly description?: string;
  readonly recommendation?: string | null;
  readonly category?: FindingCategory;
  readonly severity?: FindingSeverity;
  readonly priority?: FindingPriority;
  readonly ownerUserId?: string;
}

export interface CloseFindingRequest {
  readonly justification?: string;
}

export interface ReopenFindingRequest {
  readonly reason: string;
}

export interface FindingPage {
  readonly items: readonly Finding[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
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

export interface FindingControlLink {
  readonly id: string;
  readonly control: ControlRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

export interface FindingRiskLink {
  readonly id: string;
  readonly risk: RiskRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

export interface CreateFindingControlLinkRequest {
  readonly controlId: string;
}

export interface CreateFindingRiskLinkRequest {
  readonly riskId: string;
}
