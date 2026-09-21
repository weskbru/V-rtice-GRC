/**
 * 009-indicators-reports, T024 — composition-root wiring for
 * `AssetMetricsPort`, mirroring `asset-directory.module.ts`'s shape: a
 * tiny module binding its OWN `PrismaAssetRepository` instance, never
 * `AssetsModule` itself.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `AssetMetricsPort`, rather than relying on global
 * provider visibility that only holds when something else has already
 * imported `AssetsModule` into the same graph — a partial Nest test
 * context (a contract suite that overrides `AssetsModule` itself, for
 * instance) would otherwise fail to resolve the port (CLAUDE.md §19.10).
 * `AssetsModule` still imports this module too, so both graphs bind the
 * same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AssetMetricsPort } from '../../shared/grc-ports/asset-metrics.port';

import { AssetMetricsAdapter } from './infrastructure/asset-metrics.adapter';
import { PrismaAssetRepository } from './infrastructure/prisma-asset.repository';

@Module({
  imports: [PrismaModule],
  providers: [PrismaAssetRepository, { provide: AssetMetricsPort, useClass: AssetMetricsAdapter }],
  exports: [AssetMetricsPort],
})
export class AssetMetricsModule {}
