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
