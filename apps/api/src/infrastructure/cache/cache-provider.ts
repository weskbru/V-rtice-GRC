/**
 * `CacheProvider` port (T017 / D-2).
 *
 * Redis cannot run on this development machine (docs/local-environment.md),
 * and ADR-002/ADR-003/ADR-004 already establish that nothing authoritative
 * is ever stored in the cache — sessions, permissions and organizational
 * scope are all recomputed from PostgreSQL on a miss. D-2 turns that into an
 * explicit port with two adapters, so the rest of the codebase depends on
 * neither `ioredis` nor an in-process `Map` directly:
 *
 *   - `RedisCacheProvider` (redis-cache.provider.ts) — selected when
 *     `REDIS_URL` is set. Required in production (enforced by
 *     `env.schema.ts`), because a multi-instance deployment needs one shared
 *     view of the cache.
 *   - `InMemoryCacheProvider` (in-memory-cache.provider.ts) — selected when
 *     `REDIS_URL` is empty. Process-local; correct for a single instance,
 *     but invisible to any other process.
 *
 * Both are selected and provided under the `CACHE_PROVIDER` token by
 * `CacheModule` (cache.module.ts), which also logs which one is active.
 *
 * `increment` exists as its own method — rather than being built by callers
 * out of `get`+`set` — because rate-limit counters (FR-008, T066) need an
 * atomic read-modify-write; composing it from `get`/`set` would race under
 * concurrent requests from the same account or origin.
 */

export interface CacheProvider {
  /** Which adapter this is — read by the readiness check (T023) to decide
   * whether Redis connectivity is part of `/health/ready` at all. */
  readonly kind: 'redis' | 'in-memory';

  get<T>(key: string): Promise<T | undefined>;

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;

  del(key: string): Promise<void>;

  /** Deletes every key starting with `prefix` — used to invalidate an
   * entire cache namespace (e.g. every cached scope set for a user) at once. */
  delByPrefix(prefix: string): Promise<void>;

  /**
   * Atomically increments the counter stored at `key`, creating it at `1`
   * with `ttlSeconds` if it does not yet exist, and returns the new value.
   * The TTL is set only at creation — matching how a rolling rate-limit
   * window is expected to behave (FR-008): the window does not reset on
   * every attempt, only when it lapses.
   */
  increment(key: string, ttlSeconds: number): Promise<number>;

  /** Cheap connectivity check for `/health/ready` (T023). Never throws. */
  isHealthy(): Promise<boolean>;
}

export const CACHE_PROVIDER = Symbol('CACHE_PROVIDER');
