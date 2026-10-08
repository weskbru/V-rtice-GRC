import type { IndicatorDefinitionRecord } from '../indicator-definition.entity';
import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export interface CreateIndicatorDefinitionInput {
  readonly code: string;
  readonly metricKey: IndicatorMetricKey;
  readonly name: string;
  readonly description: string;
  readonly ownerUserId: string;
  readonly thresholdComparator: IndicatorThresholdComparator | null;
  readonly thresholdValue: number | null;
  readonly createdByUserId: string;
}

export interface IndicatorDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive: boolean | undefined;
}

export interface IndicatorDefinitionListPage {
  readonly items: readonly IndicatorDefinitionRecord[];
  readonly total: number;
}

export interface UpdateIndicatorDefinitionChanges {
  readonly name?: string;
  readonly description?: string;
  readonly ownerUserId?: string;
  readonly thresholdComparator?: IndicatorThresholdComparator | null;
  readonly thresholdValue?: number | null;
  readonly isActive?: boolean;
}

export abstract class IndicatorDefinitionRepositoryPort {
  abstract findById(id: string): Promise<IndicatorDefinitionRecord | undefined>;

  abstract findByMetricKey(
    metricKey: IndicatorMetricKey,
  ): Promise<IndicatorDefinitionRecord | undefined>;

  abstract list(query: IndicatorDefinitionListQuery): Promise<IndicatorDefinitionListPage>;

  abstract create(input: CreateIndicatorDefinitionInput): Promise<IndicatorDefinitionRecord>;

  abstract update(
    id: string,
    changes: UpdateIndicatorDefinitionChanges,
  ): Promise<IndicatorDefinitionRecord | undefined>;

  abstract listConfiguredMetricKeys(): Promise<ReadonlySet<IndicatorMetricKey>>;

  abstract listAllIds(): Promise<readonly string[]>;
}
