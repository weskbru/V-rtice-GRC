/**
 * T066 — cache port backing the per-origin half of login throttling
 * (FR-008, D-6). `core/identity/application` (`LoginThrottleService`) may
 * not depend on `CacheProvider` (top-level `infrastructure`) directly under
 * ADR-011; `CacheProviderRateLimitCacheAdapter` (`core/identity/infrastructure`)
 * is the only implementation, forwarding to the real `CacheProvider`.
 */
export abstract class RateLimitCachePort {
  /** Reads the current counter WITHOUT incrementing it — used for the
   * pre-check (`assertNotThrottled`) so a request that is already over the
   * limit never even reaches password verification. `undefined` means "no
   * attempts recorded in the current window". */
  abstract peek(key: string): Promise<number | undefined>;

  /** Atomically increments the counter, creating it at `1` with `ttlSeconds`
   * if absent (a rolling window, not reset on every attempt — D-2/D-6). */
  abstract increment(key: string, ttlSeconds: number): Promise<number>;
}
