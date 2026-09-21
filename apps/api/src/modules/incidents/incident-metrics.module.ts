/**
 * 009-indicators-reports, T027 — composition-root wiring for
 * `IncidentMetricsPort`, mirroring `incident-directory.module.ts`'s shape:
 * a tiny module binding its OWN `PrismaIncidentRepository` instance, never
 * `IncidentsModule` itself.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `IncidentMetricsPort`, rather than relying on global
 * provider visibility that only holds when something else has already
 * imported `IncidentsModule` into the same graph — a partial Nest test
 * context would otherwise fail to resolve the port (CLAUDE.md §19.10).
 * `IncidentsModule` still imports this module too, so both graphs bind
 * the same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentMetricsPort } from '../../shared/grc-ports/incident-metrics.port';

import { IncidentMetricsAdapter } from './infrastructure/incident-metrics.adapter';
import { PrismaIncidentRepository } from './infrastructure/prisma-incident.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaIncidentRepository,
    { provide: IncidentMetricsPort, useClass: IncidentMetricsAdapter },
  ],
  exports: [IncidentMetricsPort],
})
export class IncidentMetricsModule {}
