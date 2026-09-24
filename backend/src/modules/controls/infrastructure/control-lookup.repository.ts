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
}
