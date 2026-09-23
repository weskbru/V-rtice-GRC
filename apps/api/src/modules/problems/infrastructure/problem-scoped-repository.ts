import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ProblemScopedRepository extends ScopedRepository<Prisma.ProblemWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
