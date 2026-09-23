import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ActionScopedRepository extends ScopedRepository<Prisma.ActionWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
