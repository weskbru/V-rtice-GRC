/**
 * T040a — `PermissionDenialRecorderPort` implementation, the live binding
 * for FR-037's `DENIED`-audit seam left open by T035
 * (`permission-denial-recorder.port.ts`, `permission.guard.ts`).
 *
 * ## Layer placement (ADR-011) — why this is NOT
 * `core/audit/application/denied-outcome.interceptor.ts`
 *
 * The task sheet names `core/audit/application/denied-outcome.interceptor.ts`
 * as the default location. Two things about that path are wrong for what
 * this actually is, and the fix is a placement decision, not a renaming:
 *
 * 1. **"Interceptor" is the wrong NestJS concept.** `PermissionGuard`
 *    THROWS (`ForbiddenDomainError`/`UnauthorizedDomainError`) from
 *    `canActivate`. In Nest's request lifecycle, Guards run BEFORE
 *    Interceptors — when a guard throws, no interceptor for that request
 *    ever runs; the framework goes straight to the exception filter. A
 *    `denied-outcome.interceptor.ts` built as a real `NestInterceptor`
 *    would therefore never observe a permission denial at all. The guard
 *    already calls `this.denialRecorder.recordDenied(...)` itself (see
 *    `permission.guard.ts`'s `deny()` method) — that call site, not a
 *    downstream interceptor, is the only place this decision is known.
 *    What T040a actually owes is an IMPLEMENTATION of the port the guard
 *    already calls, not an interceptor.
 * 2. **`core/audit/application` cannot depend on `PrismaService`.** Under
 *    the ADR-011 boundary rules, `core-application` may only import
 *    `core-domain`/`core-application` — never the top-level
 *    `infrastructure` element `PrismaService` lives in (this is the exact
 *    reason `AuditRecorder` itself never touches `PrismaService`, per that
 *    file's own header comment). Opening a dedicated transaction for the
 *    audit insert (see below) requires `PrismaService.runInTransaction`
 *    directly, so this class could not live in `core/audit/application`
 *    either, independent of point 1.
 *
 * This class therefore lives in `core/authorization/infrastructure` — it
 * implements a port OWNED by `core/authorization/domain`, and it needs
 * `PrismaService` (top-level `infrastructure`) plus `AuditRecorder`
 * (`core/audit/application`, a DIFFERENT capability's `core-application`
 * element). Both dependencies are legal from `core-infrastructure` under
 * the boundary rules in `apps/api/eslint.config.mjs`: rule 4's
 * `core-infrastructure -> core-domain/core-application/core-infrastructure`
 * policy carries no same-capability restriction (only the `module-*`
 * policies template `captured.module` back to enforce module isolation),
 * and the explicit `core-infrastructure|module-infrastructure -> infrastructure`
 * policy covers `PrismaService`.
 *
 * ## The transaction decision (the "hard part" the task calls out)
 *
 * `AuditRecorder.record(...)` refuses to write outside an ambient
 * `prismaService.runInTransaction(...)` scope (ADR-005, enforced in
 * `PrismaAuditEventWriter`). A permission denial happens on a request path
 * that performs no business write — there is no ambient transaction to
 * join, by construction: `PermissionGuard.canActivate` runs before any
 * application-layer use case (let alone its `runInTransaction` call) is
 * ever reached.
 *
 * **Decision**: open a short-lived transaction whose ONLY statement is the
 * audit insert (`this.prisma.runInTransaction(() => this.auditRecorder
 * .record(...))`), rather than weakening `AuditRecorder`'s guard or
 * threading a `tx` through the guard. This is legitimate, not a workaround,
 * because ADR-005's atomicity guarantee ("a rolled-back change leaves no
 * audit row, a committed audit row always corresponds to a committed
 * change") is trivially satisfied when the "change" IS the audit row: a
 * `DENIED` event records that an attempt was refused, and refusing an
 * attempt performs no business mutation that the audit row could ever be
 * inconsistent with. A single-statement transaction costs one extra
 * round-trip on an already-rare, already-non-hot-path branch (a security
 * denial, not a successful request) and buys back every guarantee
 * `AuditRecorder` provides everywhere else: the insert either fully commits
 * or leaves nothing, with no risk of a half-written row.
 *
 * ## Failure handling — best-effort, never silent, never a 500
 *
 * If the audit write itself throws (a genuinely down database, an
 * allow-list registration bug, anything), this method catches it, logs it
 * via `AppLogger.auditOps` (ADR-012: "operational facts about the audit
 * subsystem, never the business trail itself") and returns normally —
 * it NEVER rethrows.
 *
 * Two things this is deliberately trading off, and why the trade is
 * correct: (1) `PermissionGuard.deny()` awaits this call before its own
 * `throw new ForbiddenDomainError()` / `UnauthorizedDomainError()` — if
 * this method rethrew, an audit-subsystem outage would turn a correct,
 * clean `403`/`401` into an unrelated `500` that leaks nothing but still
 * behaves worse for a caller who did exactly what they were supposed to
 * do (get refused) — FR-030/FR-107 forbid leaking internals through an
 * error response, and a stack trace from an audit failure is exactly that
 * kind of leak. (2) The authorization decision itself is unaffected either
 * way: `deny()` calls this BEFORE throwing, so the request is refused
 * whether or not the audit row was written — the audit subsystem's health
 * must never become a second, accidental authorization gate. Silently
 * swallowing with NO log would fail the opposite way (an audit gap nobody
 * ever learns about, in a GRC platform whose evidentiary trail is its
 * reason to exist) — `auditOps` logging is what keeps this from being
 * "vanish without a trace": an operator can alert on
 * `category: "audit_ops"` errors and detect an audit-writing outage as an
 * operational incident, independent of whether any individual denial's
 * row made it to `audit_event`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';

import { AppLogger } from '../../../infrastructure/logging/app-logger.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import {
  PermissionDenialRecorderPort,
  type PermissionDenialContext,
  type PermissionDenialReason,
} from '../domain/ports/permission-denial-recorder.port';

const UNKNOWN_ACTOR_LABEL = 'Unknown user';
const UNAUTHENTICATED_ACTOR_LABEL = 'Unauthenticated caller';

const DENIAL_ACTION_BY_REASON: Record<PermissionDenialReason, string> = {
  MISSING_PERMISSION_DECLARATION: 'authorization.denied.missing_permission_declaration',
  NO_ACTOR: 'authorization.denied.unauthenticated',
  PERMISSION_DENIED: 'authorization.denied.permission_denied',
};

@Injectable()
export class AuditPermissionDenialRecorder extends PermissionDenialRecorderPort {
  constructor(
    private readonly auditRecorder: AuditRecorder,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async recordDenied(context: PermissionDenialContext): Promise<void> {
    try {
      const actorLabel = await this.resolveActorLabel(context.actorUserId);

      // See file header: a dedicated, audit-only transaction is the
      // deliberate answer to ADR-005's "no ambient transaction" guard on a
      // request path that performs no business write.
      await this.prisma.runInTransaction(async () => {
        await this.auditRecorder.record({
          action: DENIAL_ACTION_BY_REASON[context.reason],
          entityType: AuditEntityType.PERMISSION,
          // `audit_event.entity_id` is `@db.Uuid` (schema.prisma) — a
          // `resource:action` identifier like "risk:view" is not a UUID
          // and is not guaranteed to correspond to a seeded `Permission`
          // row at the moment of a denial (a denial can legitimately
          // happen against an identifier that exists only in the
          // compile-time `PermissionRegistry`, before any seed has run).
          // The identifier is therefore carried in `newValues.identifier`
          // instead — already on `PERMISSION`'s registered field
          // allow-list (`core-entity-audit-allowlists.ts`), so it survives
          // `applyAuditFieldAllowlist` unfiltered — never in `entityId`.
          entityId: undefined,
          actorLabel,
          newValues:
            context.requiredPermission !== undefined
              ? { identifier: context.requiredPermission }
              : undefined,
          outcome: AuditOutcome.DENIED,
        });
      });
    } catch (error) {
      // Best-effort, never rethrown — see file header. Logged loudly via
      // the audit-subsystem operational category so a failure to record a
      // DENIED row is a detectable incident, not a silent gap.
      this.logger.auditOps('Failed to record a DENIED audit event for a permission refusal.', {
        reason: context.reason,
        requiredPermission: context.requiredPermission,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * `AuditRecorder.record(...)` requires `actorLabel` as a non-optional
   * string (by design — see that file's header comment: every other
   * caller already has the acting user loaded). A denial is the one
   * legitimate exception: `PermissionGuard` only ever has an id, never a
   * loaded `User`, so this is the one call site in the codebase allowed to
   * look one up — it is `core-infrastructure`, which may reach
   * `PrismaService` directly. A lookup failure (deleted/unknown user) or
   * the fully-anonymous case both fall back to a fixed, non-sensitive
   * label rather than failing the whole denial-recording attempt.
   */
  private async resolveActorLabel(actorUserId: string | undefined): Promise<string> {
    if (actorUserId === undefined) {
      return UNAUTHENTICATED_ACTOR_LABEL;
    }

    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: actorUserId },
        select: { fullName: true },
      });
      return user?.fullName ?? UNKNOWN_ACTOR_LABEL;
    } catch {
      return UNKNOWN_ACTOR_LABEL;
    }
  }
}
