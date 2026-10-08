import { Injectable } from '@nestjs/common';

import {
  emptyScope,
  globalScope,
  unitScope,
  type ScopeFilter,
} from '../../../shared/persistence/scope-filter';
import {
  OrgScopeRepositoryPort,
  type OrgScopeGrantRecord,
} from '../domain/ports/org-scope-repository.port';
import { ScopeCachePort } from '../domain/ports/scope-cache.port';

import type { CachedScopeFilter } from '../domain/ports/scope-cache.port';

const CACHE_KEY_PREFIX = 'authz:org-scope';
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class ScopeResolverService {
  constructor(
    private readonly repository: OrgScopeRepositoryPort,
    private readonly cache: ScopeCachePort,
  ) {}

  async resolveScope(userId: string): Promise<ScopeFilter> {
    const [orgTreeVersion, grantsVersion] = await Promise.all([
      this.repository.getOrgTreeVersion(),
      this.repository.getGrantsVersion(),
    ]);
    const cacheKey = this.buildCacheKey(userId, orgTreeVersion, grantsVersion);

    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      return this.fromCached(cached);
    }

    const grants = await this.repository.getUserGrants(userId);
    const scope = await this.computeScope(grants);

    await this.cache.set(cacheKey, this.toCached(scope), CACHE_TTL_SECONDS);

    return scope;
  }

  private async computeScope(grants: readonly OrgScopeGrantRecord[]): Promise<ScopeFilter> {
    if (grants.some((grant) => grant.scopeType === 'GLOBAL')) {
      return globalScope();
    }

    const grantedUnitIds = grants
      .filter(
        (grant): grant is OrgScopeGrantRecord & { orgUnitId: string } =>
          grant.scopeType === 'UNIT' && grant.orgUnitId !== undefined,
      )
      .map((grant) => grant.orgUnitId);

    if (grantedUnitIds.length === 0) {
      return emptyScope();
    }

    const expanded = await this.repository.expandToDescendants(grantedUnitIds);
    return unitScope(expanded);
  }

  private buildCacheKey(userId: string, orgTreeVersion: number, grantsVersion: number): string {
    return `${CACHE_KEY_PREFIX}:${userId}:${String(orgTreeVersion)}:${String(grantsVersion)}`;
  }

  private toCached(scope: ScopeFilter): CachedScopeFilter {
    if (scope.kind === 'GLOBAL') {
      return { kind: 'GLOBAL' };
    }
    return { kind: 'UNIT', unitIds: Array.from(scope.unitIds) };
  }

  private fromCached(cached: CachedScopeFilter): ScopeFilter {
    if (cached.kind === 'GLOBAL') {
      return globalScope();
    }
    return unitScope(cached.unitIds);
  }
}
