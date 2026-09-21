/**
 * `OrgUnitAdminRepositoryPort` implementation backed by PostgreSQL via
 * `PrismaService` (T178, ADR-004). Lives in
 * `core/organizations/infrastructure` because `PrismaService` is the
 * top-level `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 *
 * Every write here participates in whatever transaction is ambient on
 * `PrismaService`'s `AsyncLocalStorage` (opened by `OrgUnitAdminService`
 * via `TransactionRunnerPort`) — this class never opens one itself.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  OrgUnitAdminRepositoryPort,
  type ApplyReparentInput,
  type CreateOrgUnitRow,
  type OrgUnitAdminRecord,
  type OrgUnitPathInfoRecord,
  type PreviousOrgUnitFields,
  type UpdateOrgUnitFields,
} from '../domain/ports/org-unit-admin-repository.port';

import type { OrgUnitStatus } from '@prisma/client';

const ADMIN_ORG_UNIT_SELECT = {
  id: true,
  code: true,
  name: true,
  parentId: true,
  path: true,
  depth: true,
  status: true,
  _count: { select: { children: true } },
} as const;

@Injectable()
export class PrismaOrgUnitAdminRepository extends OrgUnitAdminRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listAll(status: OrgUnitStatus | undefined): Promise<readonly OrgUnitAdminRecord[]> {
    const rows = await this.prisma.client.organizationalUnit.findMany({
      where: status ? { status } : {},
      orderBy: { path: 'asc' },
      select: ADMIN_ORG_UNIT_SELECT,
    });
    return rows.map(toAdminRecord);
  }

  async findById(id: string): Promise<OrgUnitAdminRecord | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: ADMIN_ORG_UNIT_SELECT,
    });
    return row ? toAdminRecord(row) : undefined;
  }

  async findByCode(
    code: string,
    excludeUnitId?: string,
  ): Promise<{ readonly id: string } | undefined> {
    const row = await this.prisma.client.organizationalUnit.findFirst({
      where: { code, ...(excludeUnitId ? { id: { not: excludeUnitId } } : {}) },
      select: { id: true },
    });
    return row ?? undefined;
  }

  async findPathInfoById(id: string): Promise<OrgUnitPathInfoRecord | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, path: true, depth: true },
    });
    return row ?? undefined;
  }

  async findStrictDescendantsPathInfo(path: string): Promise<readonly OrgUnitPathInfoRecord[]> {
    return this.prisma.client.organizationalUnit.findMany({
      where: { path: { startsWith: path }, NOT: { path } },
      select: { id: true, path: true, depth: true },
    });
  }

  async hasActiveDescendant(path: string): Promise<boolean> {
    const count = await this.prisma.client.organizationalUnit.count({
      where: { path: { startsWith: path }, NOT: { path }, status: 'ACTIVE' },
    });
    return count > 0;
  }

  async create(input: CreateOrgUnitRow): Promise<OrgUnitAdminRecord> {
    const row = await this.prisma.client.organizationalUnit.create({
      data: {
        id: input.id,
        code: input.code,
        name: input.name,
        parentId: input.parentId ?? null,
        path: input.path,
        depth: input.depth,
      },
      select: ADMIN_ORG_UNIT_SELECT,
    });
    return toAdminRecord(row);
  }

  async updateFields(
    id: string,
    patch: UpdateOrgUnitFields,
  ): Promise<PreviousOrgUnitFields | undefined> {
    const existing = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { code: true, name: true },
    });
    if (!existing) {
      return undefined;
    }

    await this.prisma.client.organizationalUnit.update({
      where: { id },
      data: {
        ...(patch.code !== undefined ? { code: patch.code } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
      },
    });

    return existing;
  }

  async applyReparent(input: ApplyReparentInput): Promise<void> {
    await this.prisma.client.organizationalUnit.update({
      where: { id: input.unitId },
      data: { parentId: input.parentId ?? null, path: input.path, depth: input.depth },
    });

    for (const descendant of input.descendants) {
      await this.prisma.client.organizationalUnit.update({
        where: { id: descendant.id },
        data: { path: descendant.path, depth: descendant.depth },
      });
    }
  }

  async setStatus(id: string, status: OrgUnitStatus): Promise<OrgUnitStatus | undefined> {
    const existing = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) {
      return undefined;
    }
    await this.prisma.client.organizationalUnit.update({ where: { id }, data: { status } });
    return existing.status;
  }
}

interface AdminOrgUnitRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly path: string;
  readonly depth: number;
  readonly status: OrgUnitStatus;
  readonly _count: { readonly children: number };
}

function toAdminRecord(row: AdminOrgUnitRow): OrgUnitAdminRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId ?? undefined,
    path: row.path,
    depth: row.depth,
    status: row.status,
    childCount: row._count.children,
  };
}
