/**
 * T050/002-shared-grc-foundation, US2 — the sole implementation of
 * `ActionReferenceDataPort`. Mirrors
 * `grc/evidence/infrastructure/prisma-evidence-reference-data.repository.ts`
 * exactly, minus `findOrgUnit` (see the port's own header for why `Action`
 * needs none).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';

import type { UserLookup } from '../domain/ports/action-reference-data.port';

@Injectable()
export class PrismaActionReferenceDataRepository implements ActionReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

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
