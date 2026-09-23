import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RiskCodeGeneratorPort } from '../domain/ports/risk-code-generator.port';
import { formatRiskCode } from '../domain/risk-code';

@Injectable()
export class PrismaRiskCodeGenerator implements RiskCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(year: number): Promise<string> {
    const row = await this.prisma.client.riskCodeSequence.upsert({
      where: { year },
      create: { year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });

    return formatRiskCode(year, row.lastValue);
  }
}
