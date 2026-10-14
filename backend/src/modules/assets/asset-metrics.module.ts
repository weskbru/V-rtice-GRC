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
