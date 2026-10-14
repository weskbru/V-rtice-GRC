import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ProcessScopedRepository extends ScopedRepository<Prisma.ProcessWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
