export abstract class RateLimitCachePort {
  abstract peek(key: string): Promise<number | undefined>;

  abstract increment(key: string, ttlSeconds: number): Promise<number>;
}
