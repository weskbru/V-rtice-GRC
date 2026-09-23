import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditEngagementReferenceDataPort } from '../domain/ports/audit-engagement-reference-data.port';

import type {
  AuditEngagementActorLookup,
  AuditEngagementOrgUnitLookup,
} from '../domain/ports/audit-engagement-reference-data.port';

@Injectable()
export class PrismaAuditEngagementReferenceDataRepository implements AuditEngagementReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<AuditEngagementOrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(id: string): Promise<AuditEngagementActorLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true, email: true },
    });
    return row
      ? { id: row.id, isActive: row.status === 'ACTIVE', fullName: row.fullName, email: row.email }
      : undefined;
  }
}
