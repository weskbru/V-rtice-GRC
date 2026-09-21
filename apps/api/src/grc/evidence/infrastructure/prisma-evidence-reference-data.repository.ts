/**
 * T031/002-shared-grc-foundation, US1 — the sole implementation of
 * `EvidenceReferenceDataPort`. Deliberate direct `PrismaService` queries
 * against `organizational_units`/`users`, mirroring
 * `modules/risk/infrastructure/prisma-risk-reference-data.repository.ts`
 * exactly — see that file's header for why reading these shared tables
 * directly (rather than depending on Identity/Organizations' own ports,
 * shaped for authentication/scope-resolution, not "does this id exist and
 * is it active") is consistent, established precedent, not a new
 * privilege.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';

import type { OrgUnitLookup, UserLookup } from '../domain/ports/evidence-reference-data.port';

@Injectable()
export class PrismaEvidenceReferenceDataRepository implements EvidenceReferenceDataPort {
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
      select: { id: true, status: true, fullName: true },
    });
    return row
      ? { id: row.id, isActive: row.status === 'ACTIVE', fullName: row.fullName }
      : undefined;
  }
}
