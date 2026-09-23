import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlDirectoryPort } from '../../../shared/grc-ports/control-directory.port';

import type { ControlDirectoryEntry } from '../../../shared/grc-ports/control-directory.port';

@Injectable()
export class PrismaControlDirectoryAdapter implements ControlDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ControlDirectoryEntry | undefined> {
    const row = await this.prisma.client.control.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
    return row ?? undefined;
  }

  async findManyById(ids: readonly string[]): Promise<readonly ControlDirectoryEntry[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.control.findMany({
      where: { id: { in: Array.from(ids) } },
      select: { id: true, code: true, name: true, orgUnitId: true, isActive: true },
    });
  }
}
