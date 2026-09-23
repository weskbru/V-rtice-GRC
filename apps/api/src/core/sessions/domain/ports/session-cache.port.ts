import type { AuthenticationMethod } from '@prisma/client';

export interface CachedSessionSnapshot {
  readonly sessionId: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastActivityAt: string;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  readonly mustChangePassword: boolean;
}

export abstract class SessionCachePort {
  abstract get(tokenHash: string): Promise<CachedSessionSnapshot | undefined>;
  abstract set(
    tokenHash: string,
    snapshot: CachedSessionSnapshot,
    ttlSeconds: number,
  ): Promise<void>;
  abstract del(tokenHash: string): Promise<void>;
}
