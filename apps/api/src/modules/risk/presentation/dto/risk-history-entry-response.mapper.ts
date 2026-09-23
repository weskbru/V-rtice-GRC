import type { RiskHistoryEntryRecord } from '../../domain/ports/risk-history-query.port';

export interface RiskHistoryActorResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface RiskHistoryEntryResponse {
  readonly id: string;
  readonly type: RiskHistoryEntryRecord['type'];
  readonly occurredAt: string;
  readonly assessedOn: string | null;
  readonly actor: RiskHistoryActorResponse;
  readonly summary: string;
  readonly previousValue: string | null;
  readonly newValue: string | null;
  readonly referenceId: string | null;
}

export function toRiskHistoryEntryResponse(
  record: RiskHistoryEntryRecord,
): RiskHistoryEntryResponse {
  return {
    id: record.id,
    type: record.type,
    occurredAt: record.occurredAt.toISOString(),
    assessedOn: record.assessedOn ? toDateOnlyString(record.assessedOn) : null,
    actor: { id: record.actor.id, fullName: record.actor.fullName },
    summary: record.summary,
    previousValue: record.previousValue,
    newValue: record.newValue,
    referenceId: record.referenceId,
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
