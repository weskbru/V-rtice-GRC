/**
 * 009-indicators-reports, T024 (research.md D-4) — the boundary port
 * between `modules/indicators` and `modules/assets` for
 * `ASSET_INACTIVE_COUNT`. Mirrors `asset-directory.port.ts`'s own reasoning
 * for living here (`Asset` is a business-module domain, ADR-016).
 */
import type { ScopeFilter } from '../persistence/scope-filter';

export abstract class AssetMetricsPort {
  /** Count of assets with `isActive: false`, within `scope`, filtered on
   * `assets.org_unit_id` itself — never a join. */
  abstract getInactiveCount(scope: ScopeFilter): Promise<number>;
}
