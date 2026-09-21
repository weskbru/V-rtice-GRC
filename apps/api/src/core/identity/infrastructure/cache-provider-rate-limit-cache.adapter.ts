/**
 * `RateLimitCachePort` implementation, forwarding to the real
 * `CacheProvider` (T066, D-2). Lives in `core/identity/infrastructure` for
 * the same ADR-011 reason as every other `CacheProvider`-forwarding
 * adapter in this codebase.
 */
import { Inject, Injectable } from '@nestjs/common';

import { CACHE_PROVIDER, type CacheProvider } from '../../../infrastructure/cache/cache-provider';
import { RateLimitCachePort } from '../domain/ports/rate-limit-cache.port';

@Injectable()
export class CacheProviderRateLimitCacheAdapter extends RateLimitCachePort {
  constructor(@Inject(CACHE_PROVIDER) private readonly cacheProvider: CacheProvider) {
    super();
  }

  peek(key: string): Promise<number | undefined> {
    return this.cacheProvider.get<number>(key);
  }

  increment(key: string, ttlSeconds: number): Promise<number> {
    return this.cacheProvider.increment(key, ttlSeconds);
  }
}
