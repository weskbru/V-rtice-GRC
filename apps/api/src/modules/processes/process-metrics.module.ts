/**
 * 009-indicators-reports, T025 — composition-root wiring for
 * `ProcessMetricsPort`, mirroring `process-directory.module.ts`'s shape: a
 * tiny module binding its OWN `PrismaProcessRepository` instance, never
 * `ProcessesModule` itself.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `ProcessMetricsPort`, rather than relying on global
 * provider visibility that only holds when something else has already
 * imported `ProcessesModule` into the same graph — a partial Nest test
 * context would otherwise fail to resolve the port (CLAUDE.md §19.10).
 * `ProcessesModule` still imports this module too, so both graphs bind
 * the same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProcessMetricsPort } from '../../shared/grc-ports/process-metrics.port';

import { PrismaProcessRepository } from './infrastructure/prisma-process.repository';
import { ProcessMetricsAdapter } from './infrastructure/process-metrics.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaProcessRepository,
    { provide: ProcessMetricsPort, useClass: ProcessMetricsAdapter },
  ],
  exports: [ProcessMetricsPort],
})
export class ProcessMetricsModule {}
