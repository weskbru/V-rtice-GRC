export type RiskHistoryEntryType =
  'ASSESSMENT' | 'OWNERSHIP_CHANGE' | 'TREATMENT_DECISION' | 'LIFECYCLE_TRANSITION' | 'APPROVAL';

export interface RiskHistoryActorRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface RiskHistoryEntryRecord {
  readonly id: string;
  readonly type: RiskHistoryEntryType;
  readonly occurredAt: Date;
  readonly assessedOn: Date | null;
  readonly actor: RiskHistoryActorRecord;
  readonly summary: string;
  readonly previousValue: string | null;
  readonly newValue: string | null;
  readonly referenceId: string | null;
}

export interface RiskHistoryPage {
  readonly items: readonly RiskHistoryEntryRecord[];
  readonly total: number;
}

export interface RiskHistoryQuery {
  readonly riskId: string;
  readonly types?: readonly RiskHistoryEntryType[] | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export abstract class RiskHistoryQueryPort {
  abstract getHistory(query: RiskHistoryQuery): Promise<RiskHistoryPage>;
}
