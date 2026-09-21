/**
 * `RequestContextEnricherPort` implementation (T064), backed by the real
 * `RequestContextStore` (ADR-005/ADR-012). Lives in
 * `core/sessions/infrastructure` for the same ADR-011 reason as
 * `RequestContextCurrentActorProvider`/`RequestContextAuditContextAdapter`.
 */
import { Injectable } from '@nestjs/common';

import { RequestContextStore } from '../../../infrastructure/logging/request-context';
import {
  RequestContextEnricherPort,
  type RequestContextEnrichment,
} from '../domain/ports/request-context-enricher.port';

@Injectable()
export class RequestContextEnricherAdapter extends RequestContextEnricherPort {
  enrich(fields: RequestContextEnrichment): void {
    RequestContextStore.enrich(fields);
  }
}
