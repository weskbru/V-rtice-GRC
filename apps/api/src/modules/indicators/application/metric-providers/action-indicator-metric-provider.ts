/**
 * 009-indicators-reports, T026 — `ACTION_OVERDUE_COUNT`. `Action` is a
 * GRC-kernel capability (`grc/action`) — `modules/indicators` is
 * explicitly allowed to depend on `grc-domain`/`grc-application` directly
 * (ADR-016), the same way `modules/risk` already imports `ActionModule`.
 * No `shared/grc-ports` boundary port is needed here.
 *
 * Delegates to `ActionRepositoryPort.countOverdueInScope` (T026's own new
 * method, `grc/action/infrastructure/prisma-action.repository.ts`), which
 * filters on the EXACT SAME `OVERDUE_ELIGIBLE_ACTION_STATUSES` array
 * `isActionOverdue` (`grc/shared/domain/overdue.service.ts`) is built
 * from, and the identical strict `dueOn < referenceDate` comparison —
 * provably the same predicate as `isActionOverdue`, never a second
 * "is this overdue" rule (CLAUDE.md §19.7). `referenceDate` comes from
 * `todayDateOnlyUtc()`, the SAME "today" every other overdue check in this
 * platform reads from — never this file's own `new Date()`.
 */
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
