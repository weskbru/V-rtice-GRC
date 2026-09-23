import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { CacheProvider } from './cache-provider';

export class RedisCacheProvider implements CacheProvider, OnModuleDestroy {
  readonly kind = 'redis' as const;

  private readonly logger = new Logger(RedisCacheProvider.name);
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
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
