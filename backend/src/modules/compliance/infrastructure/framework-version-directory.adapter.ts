import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { FrameworkVersionDirectoryPort } from '../../../shared/grc-ports/framework-version-directory.port';

import type { FrameworkVersionDirectoryEntry } from '../../../shared/grc-ports/framework-version-directory.port';

@Injectable()
export class PrismaFrameworkVersionDirectoryAdapter implements FrameworkVersionDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<FrameworkVersionDirectoryEntry | undefined> {
    const row = await this.prisma.client.frameworkVersion.findUnique({
      where: { id },
      select: { id: true, label: true, status: true, frameworkId: true },
    });
    return row ?? undefined;
  }
}
