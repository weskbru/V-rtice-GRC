/**
 * `ScopeCachePort` implementation, forwarding to the real `CacheProvider`
 * (T039, ADR-004, D-2). Lives in `core/organizations/infrastructure`
 * because `CacheProvider` (`infrastructure/cache/cache-provider.ts`) is the
 * top-level `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 */
import { Inject, Injectable } from '@nestjs/common';

import { CACHE_PROVIDER, type CacheProvider } from '../../../infrastructure/cache/cache-provider';
import { ScopeCachePort, type CachedScopeFilter } from '../domain/ports/scope-cache.port';

@Injectable()
export class CacheProviderScopeCacheAdapter extends ScopeCachePort {
  constructor(@Inject(CACHE_PROVIDER) private readonly cacheProvider: CacheProvider) {
    super();
  }

  get(key: string): Promise<CachedScopeFilter | undefined> {
    return this.cacheProvider.get<CachedScopeFilter>(key);
  }

  set(key: string, scope: CachedScopeFilter, ttlSeconds: number): Promise<void> {
    return this.cacheProvider.set(key, scope, ttlSeconds);
  }
}
