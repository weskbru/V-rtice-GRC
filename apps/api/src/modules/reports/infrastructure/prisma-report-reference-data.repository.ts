/**
 * 009-indicators-reports, Fase 7 (T051) — the sole implementation of
 * `ReportReferenceDataPort`. Mirrors
 * `modules/indicators/infrastructure/prisma-indicator-reference-data.repository.ts`
 * exactly (minus the org-unit lookup neither module needs, research.md D-8).
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

import type { ReportUserLookup } from '../domain/ports/report-reference-data.port';

@Injectable()
export class PrismaReportReferenceDataRepository implements ReportReferenceDataPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUser(id: string): Promise<ReportUserLookup | undefined> {
    const row = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true, status: true, fullName: true },
    });
    return row
      ? { id: row.id, isActive: row.status === 'ACTIVE', fullName: row.fullName }
      : undefined;
  }
}
