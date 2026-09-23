import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';

import type {
  OrgUnitLookup,
  ReferenceDataItemRecord,
  ReferenceDataLookup,
  UserLookup,
} from '../domain/ports/risk-reference-data.port';

@Injectable()
export class PrismaRiskReferenceDataRepository implements RiskReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<OrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(id: string): Promise<UserLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true, primaryOrgUnitId: true },
    });
    return row
      ? {
          id: row.id,
          isActive: row.status === 'ACTIVE',
          fullName: row.fullName,
          primaryOrgUnitId: row.primaryOrgUnitId ?? undefined,
        }
      : undefined;
  }

  async findCategory(id: string): Promise<ReferenceDataLookup | undefined> {
    const row = await this.prisma.client.riskCategory.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    return row ? { id: row.id, isActive: row.isActive } : undefined;
  }

  async findType(id: string): Promise<ReferenceDataLookup | undefined> {
    const row = await this.prisma.client.riskType.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    return row ? { id: row.id, isActive: row.isActive } : undefined;
  }

  async findOrigin(id: string): Promise<ReferenceDataLookup | undefined> {
    const row = await this.prisma.client.riskOrigin.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    return row ? { id: row.id, isActive: row.isActive } : undefined;
  }

  async listCategories(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    const rows = await this.prisma.client.riskCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toReferenceDataItemRecord);
  }

  async listTypes(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    const rows = await this.prisma.client.riskType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toReferenceDataItemRecord);
  }

  async listOrigins(includeInactive: boolean): Promise<readonly ReferenceDataItemRecord[]> {
    const rows = await this.prisma.client.riskOrigin.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map(toReferenceDataItemRecord);
  }
}

function toReferenceDataItemRecord(row: {
  id: string;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}): ReferenceDataItemRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}
