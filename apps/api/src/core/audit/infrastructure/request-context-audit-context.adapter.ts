import { Injectable } from '@nestjs/common';

import { RequestContextStore } from '../../../infrastructure/logging/request-context';
import { AuditContextPort } from '../domain/ports/audit-context.port';

import type { AuditRequestContextSnapshot } from '../domain/audit-event.types';

@Injectable()
export class RequestContextAuditContextAdapter extends AuditContextPort {
  current(): AuditRequestContextSnapshot | undefined {
    const context = RequestContextStore.get();
    if (!context) {
      return undefined;
    }

    return {
      actorUserId: context.actorUserId,
      ipAddress: context.ipAddress.length > 0 ? context.ipAddress : undefined,
      userAgent: context.userAgent.length > 0 ? context.userAgent : undefined,
      sessionId: context.sessionId,
      correlationId: context.correlationId,
    };
  }
}
