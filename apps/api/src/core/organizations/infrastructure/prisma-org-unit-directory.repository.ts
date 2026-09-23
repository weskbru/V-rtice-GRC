import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ScopedRepository } from '../../../shared/persistence/scoped-repository';
import { OrgUnitDirectoryPort } from '../domain/ports/org-unit-directory.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  OrgUnitDirectoryStatus,
  OrgUnitNodeRecord,
} from '../domain/ports/org-unit-directory.port';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaOrgUnitDirectoryRepository
  extends ScopedRepository<Prisma.OrganizationalUnitWhereInput>
  implements OrgUnitDirectoryPort
{
  constructor(private readonly prisma: PrismaService) {
    super('id');
  }

  async listInScope(
    scope: ScopeFilter,
    status: OrgUnitDirectoryStatus,
  ): Promise<readonly OrgUnitNodeRecord[]> {
    const rows = await this.withScope(scope, { status }, (where) =>
      this.prisma.client.organizationalUnit.findMany({
        where,
        orderBy: { path: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          parentId: true,
          depth: true,
          status: true,
          _count: { select: { children: true } },
        },
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      parentId: row.parentId ?? undefined,
      depth: row.depth,
      status: row.status,
      childCount: row._count.children,
    }));
  }
}
