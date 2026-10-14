import { Injectable } from '@nestjs/common';

import { ActionRepositoryPort } from '../../../../grc/action/domain/ports/action-repository.port';
import { todayDateOnlyUtc } from '../../../../grc/shared/domain/overdue.service';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class ActionOverdueCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'ACTION_OVERDUE_COUNT' as const;

  constructor(private readonly actionRepository: ActionRepositoryPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const overdueCount = await this.actionRepository.countOverdueInScope(scope, todayDateOnlyUtc());
    return { shape: 'SINGLE_VALUE', value: overdueCount };
  }
}
