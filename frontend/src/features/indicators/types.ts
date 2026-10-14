import type { Indicators } from '@vertice/api-types';

export type IndicatorMetricKey = Indicators.components['schemas']['IndicatorMetricKey'];

export type IndicatorMetricShape = Indicators.components['schemas']['IndicatorMetricShape'];

export type IndicatorScopeApplicability =
  Indicators.components['schemas']['IndicatorScopeApplicability'];

export type IndicatorThresholdComparator =
  Indicators.components['schemas']['IndicatorThresholdComparator'];

export type UserRef = Indicators.components['schemas']['UserRef'];

export type IndicatorDefinition = Indicators.components['schemas']['IndicatorDefinition'];
export type CreateIndicatorDefinitionRequest =
  Indicators.components['schemas']['CreateIndicatorDefinitionRequest'];
export type IndicatorCurrentValue = Indicators.components['schemas']['IndicatorCurrentValue'];

export type IndicatorMeasurement = Indicators.components['schemas']['IndicatorMeasurement'];

export type IndicatorMeasurementListResponse =
  Indicators.operations['listIndicatorMeasurements']['responses']['200']['content']['application/json'];

export interface IndicatorMeasurementListQuery {
  readonly page: number;
  readonly pageSize: number;
}

export type IndicatorDefinitionListResponse =
  Indicators.operations['listIndicatorDefinitions']['responses']['200']['content']['application/json'];

export interface IndicatorDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive?: boolean;
}
