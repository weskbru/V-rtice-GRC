import type { EvidenceSource, EvidenceStatus, EvidenceType } from '@/lib/messages/evidence';
import type { GrcFoundation } from '@vertice/api-types';

export type { EvidenceSource, EvidenceStatus, EvidenceType };

export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

export type UserRef = GrcFoundation.components['schemas']['UserRef'];

export type EvidenceSubjectType =
  'RISK' | 'RISK_TREATMENT_DECISION' | 'FINDING' | 'ACTION' | 'CONTROL' | 'INCIDENT' | 'PROBLEM';

export interface Evidence {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly title: string;
  readonly description: string | null;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly owner: UserRef;
  readonly collectedOn: string;
  readonly validUntil: string | null;
  readonly status: EvidenceStatus;
  readonly expired: boolean;
  readonly externalUrl: string | null;
  readonly observation: string | null;
  readonly linkCount: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EvidenceLink {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly subjectLabel?: string;
  readonly note: string | null;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

export interface CreateEvidenceRequest {
  readonly orgUnitId: string;
  readonly title: string;
  readonly description?: string;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly ownerUserId: string;
  readonly collectedOn: string;
  readonly validUntil?: string;
  readonly externalUrl?: string;
  readonly observation?: string;
}

export interface UpdateEvidenceRequest {
  readonly title?: string;
  readonly description?: string;
  readonly type?: EvidenceType;
  readonly source?: EvidenceSource;
  readonly ownerUserId?: string;
  readonly collectedOn?: string;
  readonly validUntil?: string | null;
  readonly externalUrl?: string | null;
  readonly observation?: string | null;
}

export interface LinkEvidenceRequest {
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note?: string;
}

export interface EvidencePage {
  readonly items: readonly Evidence[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
