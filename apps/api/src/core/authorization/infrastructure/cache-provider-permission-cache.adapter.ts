import { Inject, Injectable } from '@nestjs/common';

import { CACHE_PROVIDER, type CacheProvider } from '../../../infrastructure/cache/cache-provider';
import { PermissionCachePort } from '../domain/ports/permission-cache.port';

@Injectable()
export class CacheProviderPermissionCacheAdapter extends PermissionCachePort {
  constructor(@Inject(CACHE_PROVIDER) private readonly cacheProvider: CacheProvider) {
    super();
  }

  get(key: string): Promise<readonly string[] | undefined> {
    return this.cacheProvider.get<readonly string[]>(key);
  }

  set(key: string, permissionIdentifiers: readonly string[], ttlSeconds: number): Promise<void> {
    return this.cacheProvider.set(key, permissionIdentifiers, ttlSeconds);
  }
}
