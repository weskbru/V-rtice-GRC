import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class AuditEngagementScopedRepository extends ScopedRepository<Prisma.AuditEngagementWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
