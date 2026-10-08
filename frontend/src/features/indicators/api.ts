import { apiClient } from '@/lib/api-client';

import type {
  CreateIndicatorDefinitionRequest,
  IndicatorCurrentValue,
  IndicatorDefinition,
  IndicatorDefinitionListQuery,
  IndicatorDefinitionListResponse,
  IndicatorMeasurement,
  IndicatorMeasurementListQuery,
  IndicatorMeasurementListResponse,
  IndicatorMetricKey,
} from './types';

function buildDefinitionListQueryString(query: IndicatorDefinitionListQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.isActive !== undefined) {
    params.set('isActive', String(query.isActive));
  }
  return params.toString();
}

export const indicatorsApi = {
  listDefinitions(query: IndicatorDefinitionListQuery): Promise<IndicatorDefinitionListResponse> {
    return apiClient.get<IndicatorDefinitionListResponse>(
      `/indicators?${buildDefinitionListQueryString(query)}`,
    );
  },

  createDefinition(body: CreateIndicatorDefinitionRequest): Promise<IndicatorDefinition> {
    return apiClient.post<IndicatorDefinition>('/indicators', body);
  },

  getCurrentValue(metricKey: IndicatorMetricKey): Promise<IndicatorCurrentValue> {
    return apiClient.get<IndicatorCurrentValue>(`/indicators/${metricKey}/current`);
  },

  createMeasurement(metricKey: IndicatorMetricKey): Promise<IndicatorMeasurement> {
    return apiClient.post<IndicatorMeasurement>(`/indicators/${metricKey}/measurements`);
  },

  listMeasurements(
    metricKey: IndicatorMetricKey,
    query: IndicatorMeasurementListQuery,
  ): Promise<IndicatorMeasurementListResponse> {
    const params = new URLSearchParams();
    params.set('page', String(query.page));
    params.set('pageSize', String(query.pageSize));
    return apiClient.get<IndicatorMeasurementListResponse>(
      `/indicators/${metricKey}/measurements?${params.toString()}`,
    );
  },
};
