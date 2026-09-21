/**
 * T040a — `OrgScopeDenialRecorderPort` implementation, the organizational-
 * scope half of FR-037's `DENIED`-audit requirement. Structurally the
 * mirror of `core/authorization/infrastructure/audit-permission-denial-recorder.ts`
 * (same transaction decision, same failure-handling decision) — see that
 * file's header for the fuller rationale, restated briefly below for this
 * port.
 *
 * Lives in `core/organizations/infrastructure` (not `core/audit/**`) for
 * the identical ADR-011 reason as the permission-denial recorder: it
 * implements a port owned by `core/organizations/domain` and needs
 * `PrismaService` (top-level `infrastructure`) plus `AuditRecorder`
 * (`core/audit/application`, a different capability's `core-application`
 * element) — both legal from `core-infrastructure` under
 * `apps/api/eslint.config.mjs`'s boundary policies, which place no
 * same-capability restriction on `core-infrastructure`'s allowed targets.
 *
 * ## Transaction decision
 *
 * Same as the permission-denial recorder: a scope refusal, like a
 * permission refusal, performs no business write, so a dedicated
 * short-lived `prismaService.runInTransaction(...)` wrapping only the
 * audit insert satisfies ADR-005's atomicity guarantee trivially (there is
 * no other write for the audit row to be inconsistent with) without
 * weakening `AuditRecorder`'s no-ambient-transaction guard.
 *
 * ## Failure handling
 *
 * Best-effort: a failure to write the `DENIED` row is caught, logged via
 * `AppLogger.auditOps` (never `security` — that category is for the
 * business-relevant security fact itself, which for the *response* is
 * "not found", not an audit-plumbing failure), and swallowed. The caller
 * (`OrgScopeEnforcerService`) always raises `NotFoundDomainError`
 * immediately afterward regardless of whether this succeeded — the
 * non-disclosing refusal must never depend on the audit subsystem's
 * health, and an audit outage must never surface as a client-visible `500`
 * on top of what is otherwise a correct, clean refusal.
 */
import { Injectable } from '@nestjs/common';
import { AuditOutcome } from '@prisma/client';

import { AppLogger } from '../../../infrastructure/logging/app-logger.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import {
  OrgScopeDenialRecorderPort,
  type OrgScopeDenialContext,
} from '../domain/ports/org-scope-denial-recorder.port';

const UNKNOWN_ACTOR_LABEL = 'Unknown user';
const UNAUTHENTICATED_ACTOR_LABEL = 'Unauthenticated caller';
const OUT_OF_SCOPE_ACTION = 'organization.denied.out_of_scope';

@Injectable()
export class AuditOrgScopeDenialRecorder extends OrgScopeDenialRecorderPort {
  constructor(
    private readonly auditRecorder: AuditRecorder,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async recordDenied(context: OrgScopeDenialContext): Promise<void> {
    try {
      const actorLabel = await this.resolveActorLabel(context.actorUserId);

      await this.prisma.runInTransaction(async () => {
        await this.auditRecorder.record({
          action: OUT_OF_SCOPE_ACTION,
          entityType: context.entityType,
          entityId: context.entityId,
          actorLabel,
          organizationalUnitId: context.organizationalUnitId,
          outcome: AuditOutcome.DENIED,
        });
      });
    } catch (error) {
      this.logger.auditOps(
        'Failed to record a DENIED audit event for an out-of-scope organizational access.',
        {
          entityType: context.entityType,
          entityId: context.entityId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

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
