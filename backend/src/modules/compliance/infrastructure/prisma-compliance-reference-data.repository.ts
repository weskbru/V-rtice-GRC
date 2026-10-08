import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ComplianceReferenceDataPort } from '../domain/ports/compliance-reference-data.port';

import type { ComplianceActorRecord } from '../domain/ports/compliance-reference-data.port';

@Injectable()
export class PrismaComplianceReferenceDataRepository implements ComplianceReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(userId: string): Promise<ComplianceActorRecord | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });
    return row ?? undefined;
  }
}
