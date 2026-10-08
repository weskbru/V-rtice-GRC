import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProblemMetricsPort } from '../../shared/grc-ports/problem-metrics.port';

import { PrismaProblemRepository } from './infrastructure/prisma-problem.repository';
import { ProblemMetricsAdapter } from './infrastructure/problem-metrics.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaProblemRepository,
    { provide: ProblemMetricsPort, useClass: ProblemMetricsAdapter },
  ],
  exports: [ProblemMetricsPort],
})
export class ProblemMetricsModule {}
