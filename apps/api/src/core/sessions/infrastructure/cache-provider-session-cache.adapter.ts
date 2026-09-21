/**
 * `SessionCachePort` implementation, forwarding to the real `CacheProvider`
 * (T062, ADR-002, D-2). Lives in `core/sessions/infrastructure` for the
 * same ADR-011 reason as `CacheProviderPermissionCacheAdapter`.
 */
import { Inject, Injectable } from '@nestjs/common';

import { CACHE_PROVIDER, type CacheProvider } from '../../../infrastructure/cache/cache-provider';
import { SessionCachePort, type CachedSessionSnapshot } from '../domain/ports/session-cache.port';

@Injectable()
export class CacheProviderSessionCacheAdapter extends SessionCachePort {
  constructor(@Inject(CACHE_PROVIDER) private readonly cacheProvider: CacheProvider) {
    super();
  }

  get(tokenHash: string): Promise<CachedSessionSnapshot | undefined> {
    return this.cacheProvider.get<CachedSessionSnapshot>(this.key(tokenHash));
  }

  set(tokenHash: string, snapshot: CachedSessionSnapshot, ttlSeconds: number): Promise<void> {
    return this.cacheProvider.set(this.key(tokenHash), snapshot, ttlSeconds);
  }

  del(tokenHash: string): Promise<void> {
    return this.cacheProvider.del(this.key(tokenHash));
  }

  private key(tokenHash: string): string {
    // Keyed by the HASH, never the raw token (FR-107/FR-108) — the cache
    // key itself must be as safe to log/inspect as the database column it
    // mirrors.
    return `session:${tokenHash}`;
  }
}
