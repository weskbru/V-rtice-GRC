/**
 * T019/006-assets-processes — the sole implementation of
 * `ProcessReferenceDataPort`. Identical in shape to
 * `modules/assets/infrastructure/prisma-asset-reference-data.repository.ts`
 * (FR-020).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProcessReferenceDataPort } from '../domain/ports/process-reference-data.port';

import type { ProcessOrgUnitLookup } from '../domain/ports/process-reference-data.port';

@Injectable()
export class PrismaProcessReferenceDataRepository implements ProcessReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<ProcessOrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(
    id: string,
  ): Promise<{ readonly id: string; readonly fullName: string } | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, fullName: true },
    });
    return row ?? undefined;
  }
}
