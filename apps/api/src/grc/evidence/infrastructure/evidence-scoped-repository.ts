import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class EvidenceScopedRepository extends ScopedRepository<Prisma.EvidenceWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
