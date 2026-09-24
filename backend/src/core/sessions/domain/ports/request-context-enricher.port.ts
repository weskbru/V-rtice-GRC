export interface RequestContextEnrichment {
  readonly actorUserId?: string;
  readonly sessionId: string;
  readonly authMethod: string;
}

export abstract class RequestContextEnricherPort {
  abstract enrich(fields: RequestContextEnrichment): void;
}
