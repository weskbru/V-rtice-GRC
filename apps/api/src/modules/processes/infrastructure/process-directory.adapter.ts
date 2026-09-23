import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProcessDirectoryPort } from '../../../shared/grc-ports/process-directory.port';

import type { ProcessDirectoryEntry } from '../../../shared/grc-ports/process-directory.port';

@Injectable()
export class PrismaProcessDirectoryAdapter implements ProcessDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProcessDirectoryEntry | undefined> {
    const row = await this.prisma.client.process.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
    return row ?? undefined;
  }

  async findManyById(ids: readonly string[]): Promise<readonly ProcessDirectoryEntry[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.process.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
  }
}
