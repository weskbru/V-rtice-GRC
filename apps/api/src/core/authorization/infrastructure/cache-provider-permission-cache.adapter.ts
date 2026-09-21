/**
 * `PermissionCachePort` implementation, forwarding to the real
 * `CacheProvider` (T036, ADR-003, D-2). Lives in
 * `core/authorization/infrastructure` because `CacheProvider`
 * (`infrastructure/cache/cache-provider.ts`) is the top-level
 * `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 *
 * Adapter only — no policy. Whichever `CacheProvider` adapter is active
 * (Redis or in-memory, D-2) is transparent to
 * `PermissionResolverService`, which depends on `PermissionCachePort`
 * and never sees `CacheProvider` at all.
 */
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
