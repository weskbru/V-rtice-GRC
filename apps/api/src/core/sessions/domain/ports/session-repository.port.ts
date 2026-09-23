import type { AuthenticationMethod, SessionRevocationReason } from '@prisma/client';

export interface SessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
  readonly revokedAt: Date | undefined;
  readonly revokedReason: SessionRevocationReason | undefined;
}

export interface SessionRecordWithCredentialFlags extends SessionRecord {
  readonly mustChangePassword: boolean;
}

export interface CreateSessionInput {
  readonly tokenHash: string;
  readonly userId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

export abstract class SessionRepositoryPort {
  abstract create(input: CreateSessionInput): Promise<SessionRecord>;

  abstract findByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecordWithCredentialFlags | undefined>;

  abstract touchLastActivity(sessionId: string, at: Date): Promise<void>;

  abstract markRevoked(
    sessionId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<SessionRecord | undefined>;

  abstract markRevokedForUser(
    userId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<readonly SessionRecord[]>;
}
