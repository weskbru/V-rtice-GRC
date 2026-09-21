/**
 * Cache port for resolved organizational-scope filters (T039, ADR-004,
 * D-2). Mirrors the relevant slice of
 * `infrastructure/cache/cache-provider.ts`'s `CacheProvider` — re-declared
 * here rather than imported, because `CacheProvider` lives in the
 * top-level `infrastructure` element, which `core-application` may not
 * import directly under the ADR-011 boundary rules.
 * `core/organizations/infrastructure/cache-provider-scope-cache.adapter.ts`
 * is the only implementation.
 *
 * The cached value is a plain-data serialization of `ScopeFilter`
 * (`CachedScopeFilter`), not `ScopeFilter` itself: `ScopeFilter`'s `UNIT`
 * arm carries a `ReadonlySet`, which is not JSON-serializable the way the
 * underlying `CacheProvider` (in particular the Redis adapter, which
 * `JSON.stringify`s every value) requires. `ScopeResolverService` converts
 * between the two at its cache boundary.
 */

export type CachedScopeFilter =
  { readonly kind: 'GLOBAL' } | { readonly kind: 'UNIT'; readonly unitIds: readonly string[] };

export abstract class ScopeCachePort {
  abstract get(key: string): Promise<CachedScopeFilter | undefined>;
  abstract set(key: string, scope: CachedScopeFilter, ttlSeconds: number): Promise<void>;
}
