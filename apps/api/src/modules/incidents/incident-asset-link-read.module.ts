/**
 * The composition-root wiring for the REVERSE direction of the
 * Incident<->Asset relationship — mirrors
 * `incident-risk-link-read.module.ts` exactly, against `Asset`. Binds
 * `IncidentAssetLinkReadPort` and makes it reachable from `modules/assets`'
 * own injector without either module importing the other.
 *
 * Deliberately NOT `@Global()`: `AssetsModule`'s own
 * `ListAssetIncidentLinksUseCase` imports this module directly to reach
 * `IncidentAssetLinkReadPort`, rather than relying on global provider
 * visibility that only holds when something else has already imported
 * `IncidentsModule` into the same graph — a partial Nest test context would
 * otherwise fail to resolve the port (CLAUDE.md §19.10). `IncidentsModule`
 * still imports this module too, so both graphs bind the same port the
 * same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentAssetLinkReadPort } from '../../shared/grc-ports/incident-asset-link-read.port';

import { PrismaIncidentAssetLinkReadAdapter } from './infrastructure/incident-asset-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IncidentAssetLinkReadPort, useClass: PrismaIncidentAssetLinkReadAdapter }],
  exports: [IncidentAssetLinkReadPort],
})
export class IncidentAssetLinkReadModule {}
