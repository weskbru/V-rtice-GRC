import type { CacheProvider } from './cache-provider';

interface CacheEntry {
  readonly value: unknown;
  readonly expiresAt: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  readonly kind = 'in-memory' as const;

  private readonly store = new Map<string, CacheEntry>();

  constructor(private readonly maxEntries = 10_000) {}

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return Promise.resolve(undefined);
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.delete(key);
    this.evictIfNeeded();
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  delByPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
    return Promise.resolve();
  }

  increment(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || entry.expiresAt <= now) {
      this.evictIfNeeded();
      this.store.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return Promise.resolve(1);
    }

    const nextValue = (entry.value as number) + 1;
    this.store.set(key, { value: nextValue, expiresAt: entry.expiresAt });
    return Promise.resolve(nextValue);
  }

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  private evictIfNeeded(): void {
    if (this.store.size < this.maxEntries) {
      return;
    }

    const oldestKey = this.store.keys().next().value;
    if (oldestKey !== undefined) {
      this.store.delete(oldestKey);
    }
  }
}
