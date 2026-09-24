export interface CacheProvider {
  readonly kind: 'redis' | 'in-memory';

  get<T>(key: string): Promise<T | undefined>;

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  del(key: string): Promise<void>;

  delByPrefix(prefix: string): Promise<void>;

  increment(key: string, ttlSeconds: number): Promise<number>;

  isHealthy(): Promise<boolean>;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
