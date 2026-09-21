/**
 * The composition-root wiring ADR-020 part 3 calls for, for the REVERSE
 * direction of the Incident<->Risk relationship: binds
 * `IncidentRiskLinkReadPort` to `PrismaIncidentRiskLinkReadAdapter` and
 * makes that binding reachable from `modules/risk`'s own injector, WITHOUT
 * either module importing the other.
 *
 * Deliberately NOT `@Global()`: `RiskModule`'s own
 * `ListRiskIncidentLinksUseCase` imports this module directly to reach
 * `IncidentRiskLinkReadPort`, rather than relying on global provider
 * visibility that only holds when something else has already imported
 * `IncidentsModule` into the same graph — a partial Nest test context would
 * otherwise fail to resolve the port (CLAUDE.md §19.10). `IncidentsModule`
 * still imports this module too, so both graphs bind the same port the
 * same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentRiskLinkReadPort } from '../../shared/grc-ports/incident-risk-link-read.port';

import { PrismaIncidentRiskLinkReadAdapter } from './infrastructure/incident-risk-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IncidentRiskLinkReadPort, useClass: PrismaIncidentRiskLinkReadAdapter }],
  exports: [IncidentRiskLinkReadPort],
})
export class IncidentRiskLinkReadModule {}
