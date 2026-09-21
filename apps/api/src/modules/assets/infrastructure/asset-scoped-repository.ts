/**
 * T016/006-assets-processes — `Asset`'s `ScopedRepository` base
 * (data-model.md §6: "os repositórios estendem `ScopedRepository` com
 * `scopeField = 'orgUnitId'`, como `ControlScopedRepository` já faz"). See
 * `modules/controls/infrastructure/control-scoped-repository.ts`'s header
 * for the full explanation this file does not repeat. Scope column fixed to
 * `orgUnitId` (data-model.md §1/§6).
 *
 * Base only — concrete query/write methods and the future
 * `AssetRepositoryPort` implementation belong to Fase 3 (out of this task's
 * own scope, per this task's own instructions: "Do NOT implement use cases,
 * controllers or DTOs").
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { Prisma } from '@prisma/client';

export abstract class AssetScopedRepository extends ScopedRepository<Prisma.AssetWhereInput> {
  protected constructor() {
    super('orgUnitId');
  }
}
