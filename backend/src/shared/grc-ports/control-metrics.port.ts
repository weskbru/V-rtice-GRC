import type { ScopeFilter } from '../persistence/scope-filter';

export interface ControlSummaryCounts {
  readonly total: number;
  readonly active: number;
  readonly ineffective: number;
}

export abstract class ControlMetricsPort {
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;

  abstract getSummary(scope: ScopeFilter): Promise<ControlSummaryCounts>;
}
