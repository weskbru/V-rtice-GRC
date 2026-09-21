/**
 * T016/006-assets-processes — `Process`'s `ScopedRepository` base.
 * Identical in shape to
 * `modules/assets/infrastructure/asset-scoped-repository.ts` (FR-020) — see
 * that file's own header, and
 * `modules/controls/infrastructure/control-scoped-repository.ts`'s, for the
 * full explanation this file does not repeat.
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class ProcessScopedRepository extends ScopedRepository<Prisma.ProcessWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
