import type { UnitScopeFilter } from '../persistence/scope-filter';
import type { IncidentStatus } from '@prisma/client';

export interface IncidentDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
  readonly orgUnitId: string;
}

export abstract class IncidentDirectoryPort {
  abstract findById(id: string): Promise<IncidentDirectoryEntry | undefined>;

  abstract findManyById(ids: readonly string[]): Promise<readonly IncidentDirectoryEntry[]>;

  abstract listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}
