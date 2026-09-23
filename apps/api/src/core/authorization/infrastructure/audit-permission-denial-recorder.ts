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

      await this.prisma.runInTransaction(async () => {
        await this.auditRecorder.record({
          action: DENIAL_ACTION_BY_REASON[context.reason],
          entityType: AuditEntityType.PERMISSION,
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
      this.logger.auditOps('Failed to record a DENIED audit event for a permission refusal.', {
        reason: context.reason,
        requiredPermission: context.requiredPermission,
        error: error instanceof Error ? error.message : String(error),
      });
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
