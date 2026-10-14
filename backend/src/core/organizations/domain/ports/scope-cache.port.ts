export type CachedScopeFilter =
  { readonly kind: 'GLOBAL' } | { readonly kind: 'UNIT'; readonly unitIds: readonly string[] };

export abstract class ScopeCachePort {
  abstract get(key: string): Promise<CachedScopeFilter | undefined>;
  abstract set(key: string, scope: CachedScopeFilter, ttlSeconds: number): Promise<void>;
}
