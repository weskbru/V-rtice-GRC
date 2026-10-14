import { ScopedRepository } from '../../../shared/persistence/scoped-repository';

import type { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export abstract class ControlScopedRepository extends ScopedRepository<Prisma.ControlWhereInput> {
  protected constructor(protected readonly prisma: PrismaService) {
    super('orgUnitId');
  }

  async findOrgUnitIdUnscoped(id: string): Promise<string | undefined> {
    return this.resolveOrganizationalUnitIgnoringScope(() =>
      this.prisma.client.control.findUnique({ where: { id }, select: { orgUnitId: true } }),
    );
  }
}
