/**
 * T089/T090 — the sole implementation of `RiskReferenceDataPort`. Deliberate
 * direct `PrismaService` queries against `organizationalUnit`/`user`/
 * `riskCategory`/`riskType`/`riskOrigin` rather than depending on the
 * Identity/Organizations capabilities' own ports (`UserDirectoryPort`,
 * `OrgScopeRepositoryPort`): those ports are shaped for authentication and
 * scope-resolution, not "does this id exist and is it active", and neither
 * capability's composition root currently exports a port answering that
 * narrower question. Reading the shared `users`/`organizational_units`
 * tables directly is consistent with existing precedent elsewhere in this
 * codebase (`prisma-org-scope.repository.ts` reads `organizational_units`
 * directly; `platform.seed.ts` reads/writes `users` directly) — it is not a
 * new privilege, just this module's own narrow, read-only use of it.
 */
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
