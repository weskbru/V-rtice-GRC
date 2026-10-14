import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class IncidentScopedRepository extends ScopedRepository<Prisma.IncidentWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
