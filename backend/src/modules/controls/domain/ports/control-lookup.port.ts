import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlFrequency, ControlStatus } from '@prisma/client';

export interface ControlLookupRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string;
  readonly ownerUserId: string | undefined;
  readonly status: ControlStatus;
  readonly frequency: ControlFrequency | undefined;
  readonly version: number;
}

export abstract class ControlLookupPort {
  abstract findScoped(scope: ScopeFilter, id: string): Promise<ControlLookupRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;
}
