import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AssetReferenceDataPort } from '../domain/ports/asset-reference-data.port';

import type { AssetOrgUnitLookup } from '../domain/ports/asset-reference-data.port';

@Injectable()
export class PrismaAssetReferenceDataRepository implements AssetReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<AssetOrgUnitLookup | undefined> {
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
