/**
 * 009-indicators-reports, T024 — the sole implementation of
 * `AssetMetricsPort` (`shared/grc-ports/asset-metrics.port.ts`). Delegates
 * to `PrismaAssetRepository.list` — the SAME catalog query
 * `GET /assets` already runs — with `pageSize: 1` and `isActive: false`,
 * reading only the page's own `total`.
 */
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
