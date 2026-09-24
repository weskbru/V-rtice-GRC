import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class AssetScopedRepository extends ScopedRepository<Prisma.AssetWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
