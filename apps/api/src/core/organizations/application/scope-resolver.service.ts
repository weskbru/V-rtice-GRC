/**
 * T039 — `ScopeResolverService` (ADR-004, FR-025, FR-025a, FR-025b).
 *
 * Turns a user's `OrgScopeGrant` rows into a `ScopeFilter`
 * (`shared/persistence/scope-filter.ts`) that `ScopedRepository` (T040)
 * applies as a mandatory predicate on every scoped query.
 *
 * ## The three cases, and why the empty-scope one is not the default path
 *
 * 1. **`GLOBAL` grant present** — FR-025a: "an explicit, audited assignment
 *    rather than an implicit default". `computeScope` returns
 *    `globalScope()` the moment ANY of the user's grants has
 *    `scopeType === 'GLOBAL'`; nothing in this service ever produces
 *    `GLOBAL` any other way — there is no "no grants configured yet, so
 *    assume unrestricted" fallback anywhere in this file.
 * 2. **One or more `UNIT` grants** — FR-025b: each granted unit id is
 *    expanded to itself plus every descendant via
 *    `OrgScopeRepositoryPort.expandToDescendants` (materialized-path
 *    prefix match, ADR-004), and the resulting sets are unioned into one
 *    `unitScope(...)`.
 * 3. **No grants at all** — returns `emptyScope()`
 *    (`{ kind: 'UNIT', unitIds: new Set() }`), never `globalScope()` and
 *    never a value `ScopedRepository` could mistake for "no filter". This
 *    is the exact case the task calls out as the classic catastrophic
 *    scope-system bug: a user who has not yet been granted anything must
 *    see nothing, not everything. It is reachable by construction here —
 *    `computeScope` has no branch that falls through to unrestricted
 *    access, and `ScopeFilter`'s type (see scope-filter.ts) has no
 *    "unset/undefined" arm a future edit could accidentally route this
 *    case into.
 *
 * ## Caching
 *
 * Keyed by `authz:org-scope:{userId}:{orgTreeVersion}:{grantsVersion}`
 * (ADR-004: "cached in Redis keyed by `userId:orgTreeVersion:grantsVersion`").
 * Both counters are read fresh on every call before touching the cache, so
 * a change to either the org-unit tree or the user's grants — bumped via
 * `OrgScopeRepositoryPort.bumpOrgTreeVersion`/`bumpGrantsVersion` by the
 * administration use cases (T177, a later phase) — changes the key and
 * therefore invalidates the old entry on the very next call, exactly as
 * `PermissionResolverService` does for `permissionsVersion`. A cache miss
 * always falls back to `OrgScopeRepositoryPort` (PostgreSQL) and produces
 * the identical answer.
 */
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
      // No grants at all: deny everything. See the file-level doc comment
      // — this is the one case this design must never widen into "no
      // filter".
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
