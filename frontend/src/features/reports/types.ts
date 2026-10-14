import type { Reports } from '@vertice/api-types';

export type IndicatorMetricKey = Reports.components['schemas']['IndicatorMetricKey'];

export type IndicatorScopeApplicability =
  Reports.components['schemas']['IndicatorScopeApplicability'];

export type UserRef = Reports.components['schemas']['UserRef'];

export type ReportDefinition = Reports.components['schemas']['ReportDefinition'];
export type CreateReportDefinitionRequest =
  Reports.components['schemas']['CreateReportDefinitionRequest'];

export type ReportRunItem = Reports.components['schemas']['ReportRunItem'];
export type ReportRunResult = Reports.components['schemas']['ReportRunResult'];

export type ReportDefinitionListResponse =
  Reports.operations['listReportDefinitions']['responses']['200']['content']['application/json'];

export interface ReportDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive?: boolean;
}
