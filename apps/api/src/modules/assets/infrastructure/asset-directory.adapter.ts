import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AssetDirectoryPort } from '../../../shared/grc-ports/asset-directory.port';

import type { AssetDirectoryEntry } from '../../../shared/grc-ports/asset-directory.port';

@Injectable()
export class PrismaAssetDirectoryAdapter implements AssetDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AssetDirectoryEntry | undefined> {
    const row = await this.prisma.client.asset.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
    return row ?? undefined;
  }

  async findManyById(ids: readonly string[]): Promise<readonly AssetDirectoryEntry[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.asset.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
  }
}
