import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class FindingScopedRepository extends ScopedRepository<Prisma.FindingWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
