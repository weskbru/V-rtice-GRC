import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { CacheProvider } from './cache-provider';

/**
 * `ioredis`-backed `CacheProvider` (T017), selected by `CacheModule` when
 * `REDIS_URL` is set. See cache-provider.ts for the port contract and D-2
 * for why this is never the authoritative store for anything.
 */
export class RedisCacheProvider implements CacheProvider, OnModuleDestroy {
  readonly kind = 'redis' as const;

  private readonly logger = new Logger(RedisCacheProvider.name);
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      // Fail fast rather than buffering commands indefinitely against a
      // Redis instance that never comes up — a cache outage must never hang
      // a request; callers see an error and the application falls back to
      // its authoritative source (PostgreSQL) instead.
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });

    this.redis.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.redis.get(key);
    if (raw === null) {
      return undefined;
    }

    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const pattern = `${prefix}*`;
    let cursor = '0';

    do {
      // SCAN rather than KEYS: KEYS blocks the single-threaded Redis server
      // for the duration of a full keyspace scan, which is unacceptable on
      // a shared cache used for every authenticated request.
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = nextCursor;

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== '0');
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const value = await this.redis.incr(key);

    if (value === 1) {
      await this.redis.expire(key, ttlSeconds);
    }

    return value;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }
}
