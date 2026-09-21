/**
 * T167/US7 — maps `RiskHistoryEntryRecord`
 * (`domain/ports/risk-history-query.port.ts`) to
 * `contracts/risks.openapi.yaml`'s `RiskHistoryEntry` wire shape. The ONE
 * place a history entry becomes a response body (ADR-009).
 *
 * `id`/`assessedOn` are additive fields beyond the contract's declared
 * `RiskHistoryEntry` properties (that schema sets no
 * `additionalProperties: false`) — see `RiskHistoryEntryRecord`'s own doc
 * comment and `risk-history.service.ts`'s header for why (F-9: making the
 * asserted-vs-recorded distinction visible, and a stable per-entry
 * identifier for provably-correct pagination).
 */
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

/** `assessedOn` is a `@db.Date` column (day granularity, F-9) — rendered as
 * `YYYY-MM-DD`, never a full timestamp, so it cannot be mistaken for the
 * recorded instant `occurredAt` already carries. */
function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
