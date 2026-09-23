import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ControlReferenceDataPort } from '../domain/ports/control-reference-data.port';

import type {
  ControlOrgUnitLookup,
  ControlOwnerLookup,
} from '../domain/ports/control-reference-data.port';

@Injectable()
export class PrismaControlReferenceDataRepository implements ControlReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findOrgUnit(id: string): Promise<ControlOrgUnitLookup | undefined> {
    const row = await this.prisma.client.organizationalUnit.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    return row ? { id: row.id, isActive: row.status === 'ACTIVE' } : undefined;
  }

  async findUser(id: string): Promise<ControlOwnerLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        fullName: true,
        email: true,
        primaryOrgUnitId: true,
      },
    });
    return row
      ? {
          id: row.id,
          isActive: row.status === 'ACTIVE',
          fullName: row.fullName,
          email: row.email,
          primaryOrgUnitId: row.primaryOrgUnitId ?? undefined,
        }
      : undefined;
  }
}
