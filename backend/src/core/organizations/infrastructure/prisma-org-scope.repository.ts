import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  OrgScopeRepositoryPort,
  type CreateOrgScopeGrantInput,
  type DetailedOrgScopeGrantRecord,
  type OrgScopeGrantRecord,
} from '../domain/ports/org-scope-repository.port';

import type { Prisma } from '@prisma/client';

const SINGLETON_ROW_ID = 'singleton';

@Injectable()
export class PrismaOrgScopeRepository extends OrgScopeRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getUserGrants(userId: string): Promise<readonly OrgScopeGrantRecord[]> {
    const grants = await this.prisma.client.orgScopeGrant.findMany({
      where: { userId },
      select: { scopeType: true, orgUnitId: true },
    });

    return grants.map((grant) => ({
      scopeType: grant.scopeType,
      ...(grant.orgUnitId !== null ? { orgUnitId: grant.orgUnitId } : {}),
    }));
  }

  async expandToDescendants(orgUnitIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (orgUnitIds.length === 0) {
      return new Set();
    }

    const grantedUnits = await this.prisma.client.organizationalUnit.findMany({
      where: { id: { in: Array.from(orgUnitIds) } },
      select: { path: true },
    });

    if (grantedUnits.length === 0) {
      return new Set();
    }

    const descendants = await this.prisma.client.organizationalUnit.findMany({
      where: { OR: grantedUnits.map((unit) => ({ path: { startsWith: unit.path } })) },
      select: { id: true },
    });

    return new Set(descendants.map((unit) => unit.id));
  }

  async getOrgTreeVersion(): Promise<number> {
    const state = await this.prisma.client.orgScopeCacheState.findUniqueOrThrow({
      where: { id: SINGLETON_ROW_ID },
      select: { orgTreeVersion: true },
    });
    return state.orgTreeVersion;
  }

  async getGrantsVersion(): Promise<number> {
    const state = await this.prisma.client.orgScopeCacheState.findUniqueOrThrow({
      where: { id: SINGLETON_ROW_ID },
      select: { grantsVersion: true },
    });
    return state.grantsVersion;
  }

  async bumpOrgTreeVersion(): Promise<number> {
    const state = await this.prisma.client.orgScopeCacheState.update({
      where: { id: SINGLETON_ROW_ID },
      data: { orgTreeVersion: { increment: 1 } },
      select: { orgTreeVersion: true },
    });
    return state.orgTreeVersion;
  }

  async bumpGrantsVersion(): Promise<number> {
    const state = await this.prisma.client.orgScopeCacheState.update({
      where: { id: SINGLETON_ROW_ID },
      data: { grantsVersion: { increment: 1 } },
      select: { grantsVersion: true },
    });
    return state.grantsVersion;
  }

  async userExists(userId: string): Promise<boolean> {
    const count = await this.prisma.client.user.count({ where: { id: userId } });
    return count > 0;
  }

  async listDetailedGrants(userId: string): Promise<readonly DetailedOrgScopeGrantRecord[]> {
    const rows = await this.prisma.client.orgScopeGrant.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
      select: DETAILED_GRANT_SELECT,
    });
    return rows.map(toDetailedGrantRecord);
  }

  async findDuplicateGrant(
    input: Pick<CreateOrgScopeGrantInput, 'userId' | 'scopeType' | 'orgUnitId'>,
  ): Promise<{ readonly id: string } | undefined> {
    const row = await this.prisma.client.orgScopeGrant.findFirst({
      where: {
        userId: input.userId,
        scopeType: input.scopeType,
        orgUnitId: input.orgUnitId ?? null,
      },
      select: { id: true },
    });
    return row ?? undefined;
  }

  async createGrant(input: CreateOrgScopeGrantInput): Promise<DetailedOrgScopeGrantRecord> {
    const row = await this.prisma.client.orgScopeGrant.create({
      data: {
        userId: input.userId,
        scopeType: input.scopeType,
        orgUnitId: input.orgUnitId ?? null,
        grantedByUserId: input.grantedByUserId,
        grantedAt: new Date(),
      },
      select: DETAILED_GRANT_SELECT,
    });
    return toDetailedGrantRecord(row);
  }

  async findGrantById(
    userId: string,
    grantId: string,
  ): Promise<
    | {
        readonly id: string;
        readonly scopeType: 'GLOBAL' | 'UNIT';
        readonly orgUnitId: string | undefined;
      }
    | undefined
  > {
    const row = await this.prisma.client.orgScopeGrant.findFirst({
      where: { id: grantId, userId },
      select: { id: true, scopeType: true, orgUnitId: true },
    });
    return row
      ? { id: row.id, scopeType: row.scopeType, orgUnitId: row.orgUnitId ?? undefined }
      : undefined;
  }

  async deleteGrant(grantId: string): Promise<void> {
    await this.prisma.client.orgScopeGrant.delete({ where: { id: grantId } });
  }
}

const DETAILED_GRANT_SELECT = {
  id: true,
  scopeType: true,
  orgUnit: { select: { id: true, code: true, name: true } },
  grantedByUser: { select: { id: true, fullName: true, email: true } },
  grantedAt: true,
} satisfies Prisma.OrgScopeGrantSelect;

type DetailedGrantRow = Prisma.OrgScopeGrantGetPayload<{ select: typeof DETAILED_GRANT_SELECT }>;

function toDetailedGrantRecord(row: DetailedGrantRow): DetailedOrgScopeGrantRecord {
  return {
    id: row.id,
    scopeType: row.scopeType,
    orgUnit: row.orgUnit ?? undefined,
    grantedBy: row.grantedByUser,
    grantedAt: row.grantedAt,
  };
}
