import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskDirectoryPort } from '../../../shared/grc-ports/risk-directory.port';

import type { RiskDirectoryEntry } from '../../../shared/grc-ports/risk-directory.port';

@Injectable()
export class PrismaRiskDirectoryAdapter implements RiskDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RiskDirectoryEntry | undefined> {
    const row = await this.prisma.client.risk.findUnique({
      where: { id },
      select: { id: true, code: true, title: true, orgUnitId: true, archivedAt: true },
    });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      orgUnitId: row.orgUnitId,
      isActive: row.archivedAt === null,
    };
  }
}
