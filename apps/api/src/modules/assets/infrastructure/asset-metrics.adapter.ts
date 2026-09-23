import { Injectable } from '@nestjs/common';

import { AssetMetricsPort } from '../../../shared/grc-ports/asset-metrics.port';

import { PrismaAssetRepository } from './prisma-asset.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class AssetMetricsAdapter implements AssetMetricsPort {
  constructor(private readonly assetRepository: PrismaAssetRepository) {}

  async getInactiveCount(scope: ScopeFilter): Promise<number> {
    const page = await this.assetRepository.list(
      scope,
      { isActive: false },
      { field: 'code', direction: 'asc' },
      1,
      1,
    );
    return page.total;
  }
}
