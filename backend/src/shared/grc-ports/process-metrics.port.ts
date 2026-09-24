import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class ProcessMetricsPort {
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;
}
