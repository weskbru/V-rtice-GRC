import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { formatEntityCode } from '../domain/entity-code.service';
import { EntityCodeGeneratorPort } from '../domain/ports/entity-code-generator.port';

import type { EntityCodePrefix } from '../domain/entity-code.service';

@Injectable()
export class PrismaEntityCodeGenerator implements EntityCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(prefix: EntityCodePrefix, year: number): Promise<string> {
    const row = await this.prisma.client.grcCodeSequence.upsert({
      where: { prefix_year: { prefix, year } },
      create: { prefix, year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
      select: { lastValue: true },
    });

    return formatEntityCode(prefix, year, row.lastValue);
  }
}
