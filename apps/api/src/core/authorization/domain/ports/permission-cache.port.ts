/**
 * Cache port for resolved permission sets (T036, ADR-003, D-2). Mirrors the
 * relevant slice of `infrastructure/cache/cache-provider.ts`'s
 * `CacheProvider` — deliberately re-declared here, rather than imported,
 * because `CacheProvider` lives in the top-level `infrastructure` element,
 * which `core-application` may not import directly under the ADR-011
 * boundary rules. `core/authorization/infrastructure
 * /cache-provider-permission-cache.adapter.ts` is the only implementation:
 * it is a `core-infrastructure` file, so it MAY depend on the real
 * `CacheProvider`, and simply forwards to it.
 *
 * The cache is never authoritative (D-2): every implementation of this
 * port must be safe to treat as a pure optimization — `PermissionResolverService`
 * always falls back to `PermissionRepositoryPort` (PostgreSQL) on a miss
 * and produces the identical answer either way.
 */
export abstract class PermissionCachePort {
  abstract get(key: string): Promise<readonly string[] | undefined>;
  abstract set(
    key: string,
    permissionIdentifiers: readonly string[],
    ttlSeconds: number,
  ): Promise<void>;
}
