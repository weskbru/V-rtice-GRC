import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class AuditEngagementMetricsPort {
  abstract getOpenCount(scope: ScopeFilter): Promise<number>;
}
