import type { ScopeFilter, UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface ProblemLookupRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
}

export abstract class ProblemLookupPort {
  abstract findScoped(scope: ScopeFilter, id: string): Promise<ProblemLookupRecord | undefined>;

  abstract listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}
