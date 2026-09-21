/**
 * `AuditContextPort` implementation backed by the real ambient
 * `RequestContextStore` (T029, ADR-005/ADR-012). Lives in
 * `core/audit/infrastructure` because
 * `infrastructure/logging/request-context.ts` is the top-level
 * `infrastructure` element, which only `core-infrastructure`/
 * `core-presentation` may import under the ADR-011 boundary rules.
 */
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
      // `RequestContextData.ipAddress` defaults to `''` (never
      // `undefined`) when Express could not resolve a client address —
      // translate that sentinel to `undefined` here so it is never
      // written into the `inet`-typed `audit_event.ip_address` column,
      // which rejects an empty string.
      ipAddress: context.ipAddress.length > 0 ? context.ipAddress : undefined,
      userAgent: context.userAgent.length > 0 ? context.userAgent : undefined,
      sessionId: context.sessionId,
      correlationId: context.correlationId,
    };
  }
}
