/**
 * T017/003-controls-management — `Control`'s `ScopedRepository` base
 * (data-model.md §9: "toda leitura usa o `ScopedRepository` com escopo
 * obrigatório e sem valor padrão"). See
 * `grc/evidence/infrastructure/evidence-scoped-repository.ts`'s header for
 * the full explanation this file does not repeat. Scope column fixed to
 * `orgUnitId` (data-model.md §1/§9).
 *
 * Controls sanitation (research.md D-11/D-R11): `PrismaService` now lives
 * here, injected once, because `findOrgUnitIdUnscoped` below was
 * byte-identical in both `ControlLookupRepository` and `ControlRepository`
 * — the two Prisma-backed implementations that extend this base. Moving it
 * here removes that duplication without merging `ControlLookupPort` into
 * `ControlRepositoryPort` (rejected explicitly, D-11): the narrow lookup
 * must never start paying for `ControlRepositoryPort`'s full aggregate
 * read plus an effectiveness computation on every scope check — the two
 * ports stay distinct, this base class implements a method both happen to
 * declare identically, structurally satisfying both `implements` clauses
 * without either port depending on the other.
 */
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export abstract class ControlScopedRepository extends ScopedRepository<Prisma.ControlWhereInput> {
  protected constructor(protected readonly prisma: PrismaService) {
    super('orgUnitId');
  }

  /** F-38-style escape hatch — see `RiskRepository.findOrgUnitIdUnscoped`'s
   * doc comment for the full non-disclosure reasoning this mirrors. The
   * ONE Prisma query both `ControlLookupPort.findOrgUnitIdUnscoped` and
   * `ControlRepositoryPort.findOrgUnitIdUnscoped` need — consolidated here
   * rather than duplicated in each implementation. */
  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.control.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }
}
