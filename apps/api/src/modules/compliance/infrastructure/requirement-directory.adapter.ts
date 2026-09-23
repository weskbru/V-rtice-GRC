import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RequirementDirectoryPort } from '../../../shared/grc-ports/requirement-directory.port';

import type { RequirementDirectoryEntry } from '../../../shared/grc-ports/requirement-directory.port';

@Injectable()
export class PrismaRequirementDirectoryAdapter implements RequirementDirectoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<RequirementDirectoryEntry | undefined> {
    const row = await this.prisma.client.requirement.findUnique({
      where: { id },
      select: {
        id: true,
        externalRef: true,
        title: true,
        frameworkVersionId: true,
        frameworkVersion: { select: { status: true } },
      },
    });
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      externalRef: row.externalRef,
      title: row.title,
      frameworkVersionId: row.frameworkVersionId,
      frameworkVersionStatus: row.frameworkVersion.status,
    };
  }
}
