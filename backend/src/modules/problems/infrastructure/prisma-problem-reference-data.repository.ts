import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProblemReferenceDataPort } from '../domain/ports/problem-reference-data.port';

import type {
  ProblemOrgUnitLookup,
  ProblemOwnerLookup,
} from '../domain/ports/problem-reference-data.port';

@Injectable()
export class PrismaProblemReferenceDataRepository implements ProblemReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<ProblemOrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(id: string): Promise<ProblemOwnerLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true, primaryOrgUnitId: true },
    });
    return row
      ? {
          id: row.id,
          isActive: row.status === 'ACTIVE',
          fullName: row.fullName,
          primaryOrgUnitId: row.primaryOrgUnitId ?? undefined,
        }
      : undefined;
  }
}
