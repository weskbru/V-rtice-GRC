/**
 * `SessionRepositoryPort` implementation (T062). Uses `prisma.client`
 * (ambient-transaction-aware getter, see `PrismaService`'s own header) so a
 * caller inside `runInTransaction(...)` gets atomicity with whatever else
 * runs in that scope, and a caller outside one (the lazy-expiry "touch",
 * which needs no atomicity) gets the plain connection.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  SessionRepositoryPort,
  type CreateSessionInput,
  type SessionRecord,
  type SessionRecordWithCredentialFlags,
} from '../domain/ports/session-repository.port';

import type { Session, SessionRevocationReason } from '@prisma/client';

@Injectable()
export class PrismaSessionRepository extends SessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    const row = await this.prisma.client.session.create({
      data: {
        tokenHash: input.tokenHash,
        userId: input.userId,
        authenticationMethod: input.authenticationMethod,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
        lastActivityAt: input.lastActivityAt,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    return this.toRecord(row);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionRecordWithCredentialFlags | undefined> {
    // S-01 (audit A6-F01): joins the owning user's local credential in the
    // SAME query — no redundant round-trip — so `SessionService` can
    // populate `ValidatedSession.mustChangePassword` without a second
    // lookup. A user with no `LocalCredential` (a federated identity, not
    // implemented in this release) reads as `false`, never `undefined`.
    const row = await this.prisma.client.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { localCredential: true } } },
    });
    if (!row) {
      return undefined;
    }
    return {
      ...this.toRecord(row),
      mustChangePassword: row.user.localCredential?.mustChangePassword ?? false,
    };
  }

  async touchLastActivity(sessionId: string, at: Date): Promise<void> {
    // `updateMany` (not `update`) so a session concurrently deleted/revoked
    // (which never happens by deletion in this schema, but keeps this
    // robust) never throws a not-found error for what is, at most, a
    // best-effort bookkeeping write.
    await this.prisma.client.session.updateMany({
      where: { id: sessionId },
      data: { lastActivityAt: at },
    });
  }

  async markRevoked(
    sessionId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<SessionRecord | undefined> {
    const result = await this.prisma.client.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });
    if (result.count === 0) {
      return undefined;
    }
    const row = await this.prisma.client.session.findUnique({ where: { id: sessionId } });
    return row ? this.toRecord(row) : undefined;
  }

  async markRevokedForUser(
    userId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<readonly SessionRecord[]> {
    const active = await this.prisma.client.session.findMany({
      where: { userId, revokedAt: null },
    });
    if (active.length === 0) {
      return [];
    }

    await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at, revokedReason: reason },
    });

    return active.map((row) => this.toRecord({ ...row, revokedAt: at, revokedReason: reason }));
  }

  private toRecord(row: Session): SessionRecord {
    return {
      id: row.id,
      tokenHash: row.tokenHash,
      userId: row.userId,
      authenticationMethod: row.authenticationMethod,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActivityAt: row.lastActivityAt,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
      revokedAt: row.revokedAt ?? undefined,
      revokedReason: row.revokedReason ?? undefined,
    };
  }
}
