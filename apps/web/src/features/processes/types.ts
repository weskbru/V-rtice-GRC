export type SortDirection = 'asc' | 'desc';

export type ProcessListSortField = 'code' | 'name' | 'updatedAt';

export interface OrgUnitRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OrgUnitNode {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

export interface ProcessSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: OrgUnitRef | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

export interface ProcessDetail extends ProcessSummary {
  readonly description: string | null;
  readonly createdAt: string;
  readonly risks: readonly RiskRef[];
  readonly controls: readonly ControlRef[];
}

export interface CreateProcessRequest {
  name: string;
  description?: string;
  orgUnitId: string;
}

export interface UpdateProcessRequest {
  name?: string;
  description?: string;
  orgUnitId?: string;
}

export interface ProcessListQuery {
  page: number;
  pageSize: number;
  q?: string;
  orgUnitId?: readonly string[];
  isActive?: boolean;
  sort?: ProcessListSortField;
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

export type IncidentStatusRef = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface IncidentRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatusRef;
}

export interface LinkUserRef {
  readonly id: string;
  readonly fullName: string;
}

export interface ProcessIncidentLink {
  readonly id: string;
  readonly incident: IncidentRef;
  readonly linkedBy: LinkUserRef;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}
