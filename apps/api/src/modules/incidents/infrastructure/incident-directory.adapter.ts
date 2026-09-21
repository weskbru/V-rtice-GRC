/**
 * 008-incidents-problems, foundation — the sole implementation of
 * `IncidentDirectoryPort` (`shared/grc-ports/incident-directory.port.ts`).
 * `modules/incidents` OWNS the `incidents` table, so this adapter is the
 * one place in the platform allowed to query it on behalf of another
 * module. Mirrors `PrismaControlDirectoryAdapter` exactly.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IncidentDirectoryPort } from '../../../shared/grc-ports/incident-directory.port';
import { applyScopeToWhere } from '../../../shared/persistence/scope-filter';

import type { IncidentDirectoryEntry } from '../../../shared/grc-ports/incident-directory.port';
import type { UnitScopeFilter } from '../../../shared/persistence/scope-filter';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PrismaIncidentDirectoryAdapter implements IncidentDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<IncidentDirectoryEntry | undefined> {
    const row = await this.prisma.client.incident.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, status: true, orgUnitId: true },
    });
    return row ?? undefined;
  }

  async findManyById(ids: readonly string[]): Promise<readonly IncidentDirectoryEntry[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.incident.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, code: true, title: true, status: true, orgUnitId: true },
    });
  }

  async listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    const where = applyScopeToWhere<Prisma.IncidentWhereInput>(scope, 'orgUnitId', {});
    const rows = await this.prisma.client.incident.findMany({ where, select: { id: true } });
    return rows.map((row) => row.id);
  }
}
