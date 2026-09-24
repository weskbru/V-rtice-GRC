import type { Incidents } from '@pharos/api-types';

export type IncidentSeverity = Incidents.components['schemas']['IncidentSeverity'];
export type IncidentStatus = Incidents.components['schemas']['IncidentStatus'];

export type OrgUnitRef = Incidents.components['schemas']['OrgUnitRef'];

export type UserRef = Incidents.components['schemas']['UserRef'];

export type RiskRef = Incidents.components['schemas']['RiskRef'];
export type AssetRef = Incidents.components['schemas']['AssetRef'];
export type ProcessRef = Incidents.components['schemas']['ProcessRef'];
export type ProblemRef = Incidents.components['schemas']['ProblemRef'];
export type ProblemStatusRef = Incidents.components['schemas']['ProblemStatusRef'];

export type IncidentSummary = Incidents.components['schemas']['IncidentSummary'];
export type IncidentDetail = Incidents.components['schemas']['IncidentDetail'];

export type CreateIncidentRequest = Incidents.components['schemas']['CreateIncidentRequest'];
export type UpdateIncidentRequest = Incidents.components['schemas']['UpdateIncidentRequest'];
export type TransitionIncidentRequest =
  Incidents.components['schemas']['TransitionIncidentRequest'];

export type IncidentRiskLinkResponse = Incidents.components['schemas']['IncidentRiskLinkResponse'];
export type IncidentAssetLinkResponse =
  Incidents.components['schemas']['IncidentAssetLinkResponse'];
export type IncidentProcessLinkResponse =
  Incidents.components['schemas']['IncidentProcessLinkResponse'];
export type IncidentProblemLinkResponse =
  Incidents.components['schemas']['IncidentProblemLinkResponse'];

export type IncidentListResponse =
  Incidents.operations['listIncidents']['responses']['200']['content']['application/json'];

export type LinkIncidentToRiskRequest =
  Incidents.operations['linkIncidentToRisk']['requestBody']['content']['application/json'];
export type LinkIncidentToAssetRequest =
  Incidents.operations['linkIncidentToAsset']['requestBody']['content']['application/json'];
export type LinkIncidentToProcessRequest =
  Incidents.operations['linkIncidentToProcess']['requestBody']['content']['application/json'];

export interface IncidentRegisterQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: readonly IncidentStatus[];
  readonly severity?: readonly IncidentSeverity[];
  readonly orgUnitId?: string;
  readonly sort?: 'code' | 'title' | 'severity' | 'status' | 'reportedOn' | 'updatedAt';
  readonly direction?: 'asc' | 'desc';
}
