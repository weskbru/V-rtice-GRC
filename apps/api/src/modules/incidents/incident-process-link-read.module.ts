/**
 * The composition-root wiring for the REVERSE direction of the
 * Incident<->Process relationship — mirrors
 * `incident-risk-link-read.module.ts` exactly, against `Process`. Binds
 * `IncidentProcessLinkReadPort` and makes it reachable from
 * `modules/processes`' own injector without either module importing the
 * other.
 *
 * Deliberately NOT `@Global()`: `ProcessesModule`'s own
 * `ListProcessIncidentLinksUseCase` imports this module directly to reach
 * `IncidentProcessLinkReadPort`, rather than relying on global provider
 * visibility that only holds when something else has already imported
 * `IncidentsModule` into the same graph — a partial Nest test context would
 * otherwise fail to resolve the port (CLAUDE.md §19.10). `IncidentsModule`
 * still imports this module too, so both graphs bind the same port the
 * same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentProcessLinkReadPort } from '../../shared/grc-ports/incident-process-link-read.port';

import { PrismaIncidentProcessLinkReadAdapter } from './infrastructure/incident-process-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: IncidentProcessLinkReadPort, useClass: PrismaIncidentProcessLinkReadAdapter },
  ],
  exports: [IncidentProcessLinkReadPort],
})
export class IncidentProcessLinkReadModule {}
