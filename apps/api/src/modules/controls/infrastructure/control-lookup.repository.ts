/**
 * T027-T042/003-controls-management, User Story 2/3 — the sole
 * implementation of `ControlLookupPort`
 * (`domain/ports/control-lookup.port.ts` — see that file's header for why
 * this is a narrow, independent read rather than a dependency on
 * `ControlRepositoryPort`). Extends `ControlScopedRepository` (T017), the
 * stable scoped-repository base every Controls read/write ultimately
 * shares.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlLookupPort } from '../domain/ports/control-lookup.port';

import { ControlScopedRepository } from './control-scoped-repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlLookupRecord } from '../domain/ports/control-lookup.port';

const SELECT = {
  id: true,
  code: true,
  name: true,
  orgUnitId: true,
  ownerUserId: true,
  status: true,
  frequency: true,
  version: true,
} as const;

@Injectable()
export class ControlLookupRepository extends ControlScopedRepository implements ControlLookupPort {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findScoped(scope: ScopeFilter, id: string): Promise<ControlLookupRecord | undefined> {
    const row = await this.withScope(scope, { id }, (where) =>
      this.prisma.client.control.findFirst({ where, select: SELECT }),
    );
    if (!row?.orgUnitId) {
      // A control with no `orgUnitId` at all (the rare legacy Fase-1 row,
      // data-model.md §1) can never be proven within a `UNIT` scope and
      // is only reachable under `GLOBAL` — `withScope`'s own predicate
      // already enforces that; a `null` org unit here is therefore
      // treated as "not found", matching FR-007's non-disclosure rule.
      return undefined;
    }
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      orgUnitId: row.orgUnitId,
      ownerUserId: row.ownerUserId ?? undefined,
      status: row.status,
      frequency: row.frequency ?? undefined,
      version: row.version,
    };
  }

  // `findOrgUnitIdUnscoped` is implemented once, on `ControlScopedRepository`
  // (research.md D-11/D-R11) — both this class and `ControlRepository` used
  // to duplicate the identical Prisma query.
}
