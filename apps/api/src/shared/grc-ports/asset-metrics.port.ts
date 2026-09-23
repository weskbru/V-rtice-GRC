import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class AssetMetricsPort {
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;
}
