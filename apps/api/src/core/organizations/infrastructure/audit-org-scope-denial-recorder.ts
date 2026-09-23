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
