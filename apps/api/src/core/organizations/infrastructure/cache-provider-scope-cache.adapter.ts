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
