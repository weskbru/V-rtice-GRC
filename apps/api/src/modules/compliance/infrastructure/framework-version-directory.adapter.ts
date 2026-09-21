/**
 * T016/005-audit-findings — the sole implementation of
 * `FrameworkVersionDirectoryPort` (`shared/grc-ports/framework-version-directory.port.ts`,
 * ADR-020 part 3). `modules/compliance` OWNS the `framework_versions` table,
 * so this adapter is the one place in the platform allowed to query it on
 * behalf of another module (`modules/audit-engagements`).
 */
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
