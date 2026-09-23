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
