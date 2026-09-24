import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome, SessionRevocationReason } from '@prisma/client';

import { AppLogger } from '../../../infrastructure/logging/app-logger.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { RequestContextEnricherPort } from '../domain/ports/request-context-enricher.port';
import { SessionExpiryRecorderPort } from '../domain/ports/session-expiry-recorder.port';
import { SessionRepositoryPort, type SessionRecord } from '../domain/ports/session-repository.port';

const UNKNOWN_ACTOR_LABEL = 'Unknown user';

@Injectable()
export class AuditSessionExpiryRecorder extends SessionExpiryRecorderPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly requestContextEnricher: RequestContextEnricherPort,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async expireSession(session: SessionRecord): Promise<SessionRecord> {
    try {
      let result = session;

      await this.prisma.runInTransaction(async () => {
        const revoked = await this.sessionRepository.markRevoked(
          session.id,
          SessionRevocationReason.EXPIRED,
          new Date(),
        );
        if (!revoked) {
          return;
        }
        result = revoked;

        this.requestContextEnricher.enrich({
          sessionId: revoked.id,
          authMethod: revoked.authenticationMethod,
        });

        const actorLabel = await this.resolveActorLabel(revoked.userId);
        await this.auditRecorder.record({
          action: 'session.expired',
          entityType: AuditEntityType.SESSION,
          entityId: revoked.id,
          actorLabel,
          newValues: { revokedAt: revoked.revokedAt, revokedReason: revoked.revokedReason },
          outcome: AuditOutcome.SUCCESS,
        });
      });

      return result;
    } catch (error) {
      this.logger.auditOps('Failed to record session expiry.', {
        sessionId: session.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return session;
    }
  }

  private async resolveActorLabel(userId: string): Promise<string> {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      return user?.fullName ?? UNKNOWN_ACTOR_LABEL;
    } catch {
      return UNKNOWN_ACTOR_LABEL;
    }
  }
}
