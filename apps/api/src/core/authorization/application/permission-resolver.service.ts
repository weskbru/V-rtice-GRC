/**
 * T036 — effective-permission resolution (ADR-003, FR-028).
 *
 * `PermissionGuard` (`core/authorization/presentation/permission.guard.ts`)
 * is the ONLY caller this service is designed for in this release — it is
 * "the single decision path" (ADR-003) precisely because every permission
 * check, everywhere in the platform, resolves the caller's effective
 * permissions through this one service and nothing else.
 *
 * ## Where `permissionsVersion` lives, and how it is bumped
 *
 * `permissionsVersion` is a durable integer counter in PostgreSQL — the
 * `permission_cache_state` table's single row (see schema.prisma and the
 * `20260905130100_authorization_scope_cache_counters` migration) — read
 * and incremented through `PermissionRepositoryPort`. It is NOT stored
 * only inside the cache: `CacheProvider` entries can be evicted or expire
 * independently of one another, and if the counter itself lived only
 * there, it resetting to a lower value while an older, still-unexpired
 * resolved-permission-set entry survived under a matching lower-numbered
 * key would silently serve stale permissions after a role change — the
 * exact class of bug this design must not reintroduce.
 *
 * The cache KEY embeds the current version
 * (`authz:permissions:{userId}:{permissionsVersion}`); bumping the counter
 * therefore invalidates every affected user's cached entry for free, on
 * their very next request (FR-028 — "without requiring the user to sign in
 * again"), with no need to enumerate or delete individual cache keys, and
 * no TTL to wait out. `bumpPermissionsVersion()` is exposed on
 * `PermissionRepositoryPort` and is called by the administration use cases
 * (T177, a later phase) whenever a `Role`, `RolePermission` or `UserRole`
 * row changes — nothing in this capability calls it today; publishing the
 * method now is what lets T177 depend on the port without this capability
 * growing an administration feature of its own.
 *
 * ## Cache miss behavior
 *
 * `getEffectivePermissions` always reads the CURRENT `permissionsVersion`
 * and CURRENT cache entry for that version before deciding anything. On a
 * miss (first request after a bump, a cold cache, or the in-memory
 * adapter's process-local eviction, D-2) it queries
 * `PermissionRepositoryPort.getEffectivePermissionIdentifiers` — PostgreSQL,
 * always authoritative — repopulates the cache under the current version's
 * key, and returns that answer. A cache hit and a cache miss are
 * observationally identical to every caller: the cache can never make this
 * method return something the database would not have.
 */
import { Injectable } from '@nestjs/common';

import { PermissionCachePort } from '../domain/ports/permission-cache.port';
import { PermissionRepositoryPort } from '../domain/ports/permission-repository.port';

import type { PermissionIdentifier } from '../domain/permissions';

const CACHE_KEY_PREFIX = 'authz:permissions';
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly repository: PermissionRepositoryPort,
    private readonly cache: PermissionCachePort,
  ) {}

  /**
   * The caller's effective permission identifiers (union across every role
   * they hold), as a `ReadonlySet` for O(1) membership checks. Never
   * throws for an unknown user — an empty set is returned, and
   * `hasPermission` for any identifier against an empty set is `false`,
   * which is the correct fail-closed answer for a user with no roles.
   */
  async getEffectivePermissions(userId: string): Promise<ReadonlySet<PermissionIdentifier>> {
    const version = await this.repository.getPermissionsVersion();
    const cacheKey = this.buildCacheKey(userId, version);

    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      return new Set(cached) as ReadonlySet<PermissionIdentifier>;
    }

    const fresh = await this.repository.getEffectivePermissionIdentifiers(userId);
    await this.cache.set(cacheKey, fresh, CACHE_TTL_SECONDS);

    return new Set(fresh) as ReadonlySet<PermissionIdentifier>;
  }

  /** Convenience form of `getEffectivePermissions` for the single-permission
   * check `PermissionGuard` needs on every request. */
  async hasPermission(userId: string, permission: PermissionIdentifier): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(userId);
    return permissions.has(permission);
  }

  private buildCacheKey(userId: string, permissionsVersion: number): string {
    return `${CACHE_KEY_PREFIX}:${userId}:${String(permissionsVersion)}`;
  }
}
