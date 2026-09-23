import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';

export type OrgUnitDirectoryStatus = 'ACTIVE' | 'INACTIVE';

export interface OrgUnitNodeRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | undefined;
  readonly depth: number;
  readonly status: OrgUnitDirectoryStatus;
  readonly childCount: number;
}

export abstract class OrgUnitDirectoryPort {
  abstract listInScope(
    scope: ScopeFilter,
    status: OrgUnitDirectoryStatus,
  ): Promise<readonly OrgUnitNodeRecord[]>;
}
