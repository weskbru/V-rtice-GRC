import type { Problems } from '@vertice/api-types';

export type ProblemSeverity = Problems.components['schemas']['ProblemSeverity'];
export type ProblemStatus = Problems.components['schemas']['ProblemStatus'];

export type OrgUnitRef = Problems.components['schemas']['OrgUnitRef'];

export type UserRef = Problems.components['schemas']['UserRef'];

export type RiskRef = Problems.components['schemas']['RiskRef'];
export type IncidentRef = Problems.components['schemas']['IncidentRef'];
export type IncidentStatusRef = Problems.components['schemas']['IncidentStatusRef'];

export type ProblemSummary = Problems.components['schemas']['ProblemSummary'];
export type ProblemDetail = Problems.components['schemas']['ProblemDetail'];

export type CreateProblemRequest = Problems.components['schemas']['CreateProblemRequest'];
export type UpdateProblemRequest = Problems.components['schemas']['UpdateProblemRequest'];
export type TransitionProblemRequest = Problems.components['schemas']['TransitionProblemRequest'];

export type ProblemRiskLinkResponse = Problems.components['schemas']['ProblemRiskLinkResponse'];
export type ProblemIncidentLinkResponse =
  Problems.components['schemas']['ProblemIncidentLinkResponse'];

export type ProblemListResponse =
  Problems.operations['listProblems']['responses']['200']['content']['application/json'];

export type LinkProblemToRiskRequest =
  Problems.operations['linkProblemToRisk']['requestBody']['content']['application/json'];
export type LinkProblemToIncidentRequest =
  Problems.operations['linkProblemToIncident']['requestBody']['content']['application/json'];

export interface ProblemRegisterQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: readonly ProblemStatus[];
  readonly severity?: readonly ProblemSeverity[];
  readonly orgUnitId?: string;
  readonly sort?: 'code' | 'title' | 'severity' | 'status' | 'identifiedOn' | 'updatedAt';
  readonly direction?: 'asc' | 'desc';
}
