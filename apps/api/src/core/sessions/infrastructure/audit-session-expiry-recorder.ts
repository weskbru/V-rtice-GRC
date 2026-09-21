/**
 * `SessionExpiryRecorderPort` implementation (T062/T068, FR-014, FR-018).
 * Structurally identical to `AuditPermissionDenialRecorder`/
 * `AuditOrgScopeDenialRecorder` — see those files' headers for the fuller
 * rationale on the transaction and failure-handling decisions, restated
 * briefly here.
 *
 * Lives in `core/sessions/infrastructure` because it needs `PrismaService`
 * (top-level `infrastructure`) and `SessionRepositoryPort`/`AuditRecorder` —
 * both legal from `core-infrastructure` under the ADR-011 boundary
 * policies.
 */
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
          // Already revoked by a concurrent request — nothing to audit
          // again (revocation, like this method, is idempotent).
          return;
        }
        result = revoked;

        // D-13/FR-028 decision (session.expired, decided separately from
        // session.created, and reversed once from an earlier draft of this
        // comment that attributed it to `revoked.userId` — recorded here
        // because the reason matters more than the outcome): a session
        // expiring is not something its owner DID. It is something the
        // platform discovered, possibly on a request that was not even
        // theirs — a replayed stale cookie triggers this exact same path.
        // Putting the owner's id in `actor_user_id` would let this row
        // answer "everything this user did", which is false; in an
        // evidentiary audit trail a wrong actor is worse than an absent
        // one. The constitution (Principle VII) requires a genuinely
        // system-initiated action to be attributed to an explicitly
        // identified SYSTEM PRINCIPAL, never to the human it happened to —
        // and this codebase has no system-principal mechanism today (no
        // `ActorType`, no system-user row, nothing). Inventing one as a
        // side effect of this fix is out of scope; a real one is future
        // work, triggered by this platform's first genuine background job
        // (a scheduler, a queue worker — something that is not a request
        // handler reacting to a stale cookie). Until then, `actor_user_id`
        // stays NULL here deliberately, not by omission.
        //
        // `sessionId` IS enriched: it is a fact about the event (which
        // session expired), useful for correlation, and carries no false
        // claim about who acted. `authMethod` travels with it because the
        // port's `sessionId` and `authMethod` fields are both required
        // (only `actorUserId` is optional, precisely for this call site).
        // `actorLabel` below is deliberately left as `resolveActorLabel
        // (revoked.userId)` — it already reads as "whose session", which
        // is true, and the audit `action` name ("session.expired") already
        // says what happened; the label needs no comment update.
        //
        // No regression test asserts on `actor_user_id`/`sessionId` for
        // this event: the existing test calls `sessionService
        // .validateSession(...)` directly, outside any HTTP request, so
        // `RequestContextStore.enrich(...)` correctly no-ops there (no
        // ambient context to enrich) regardless of whether this fix is
        // right. Asserting non-null `sessionId` in that harness would fail
        // for a reason unrelated to this code's correctness. A real test
        // needs an HTTP-level path through `SessionGuard`
        // (`test/contract/**`) — recorded here so the absence reads as a
        // deliberate scoping decision, not an oversight.
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
      // Best-effort, never rethrown — see file header. `SessionService`
      // already knows, independently of this write, that the session must
      // be refused for the current request regardless of whether the
      // revocation/audit row was persisted.
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
