/**
 * 009-indicators-reports, T028 — composition-root wiring for
 * `ProblemMetricsPort`, mirroring `problem-risk-link-read.module.ts`'s
 * shape: a tiny module binding its OWN `PrismaProblemRepository` instance,
 * never `ProblemsModule` itself.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `ProblemMetricsPort`, rather than relying on global
 * provider visibility that only holds when something else has already
 * imported `ProblemsModule` into the same graph — a partial Nest test
 * context would otherwise fail to resolve the port (CLAUDE.md §19.10).
 * `ProblemsModule` still imports this module too, so both graphs bind
 * the same port the same way.
 */
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
