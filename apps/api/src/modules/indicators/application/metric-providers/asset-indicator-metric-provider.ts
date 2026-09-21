/**
 * 009-indicators-reports, T024 — `ASSET_INACTIVE_COUNT`. Delegates to
 * `AssetMetricsPort` (`shared/grc-ports/asset-metrics.port.ts`), which
 * itself reuses `PrismaAssetRepository.list` — no query of this file's
 * own.
 */
import { Injectable } from '@nestjs/common';

import { AssetMetricsPort } from '../../../../shared/grc-ports/asset-metrics.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';

@Injectable()
export class AssetInactiveCountProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'ASSET_INACTIVE_COUNT' as const;

  constructor(private readonly assetMetrics: AssetMetricsPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const inactiveCount = await this.assetMetrics.getInactiveCount(scope);
    return { shape: 'SINGLE_VALUE', value: inactiveCount };
  }
}
