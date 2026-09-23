import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import type { IndicatorUserLookup } from '../domain/ports/indicator-reference-data.port';

@Injectable()
export class PrismaIndicatorReferenceDataRepository implements IndicatorReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: string): Promise<IndicatorUserLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true },
    });
    return row
      ? { id: row.id, isActive: row.status === 'ACTIVE', fullName: row.fullName }
      : undefined;
  }

  async findUserOrgUnitId(userId: string): Promise<string | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { primaryOrgUnitId: true },
    });
    return row?.primaryOrgUnitId ?? undefined;
  }
}
