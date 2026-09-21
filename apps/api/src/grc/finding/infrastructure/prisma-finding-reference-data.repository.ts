/**
 * T069/002-shared-grc-foundation, US3 — the sole implementation of
 * `FindingReferenceDataPort`. Mirrors
 * `grc/evidence/infrastructure/prisma-evidence-reference-data.repository.ts`
 * exactly — see that file's header for why reading these shared tables
 * directly is consistent, established precedent.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FindingReferenceDataPort } from '../domain/ports/finding-reference-data.port';

import type { OrgUnitLookup, UserLookup } from '../domain/ports/finding-reference-data.port';

@Injectable()
export class PrismaFindingReferenceDataRepository implements FindingReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<OrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(id: string): Promise<UserLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true },
    });
    return row
      ? { id: row.id, isActive: row.status === 'ACTIVE', fullName: row.fullName }
      : undefined;
  }
}
