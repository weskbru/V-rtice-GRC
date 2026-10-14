import type { ActionRecord } from '../../../../grc/action/domain/ports/action-repository.port';
import type { ActionStatus } from '@prisma/client';

export interface TreatmentActionListFilters {
  readonly status?: readonly ActionStatus[] | undefined;
  readonly overdue?: boolean | undefined;
}

export interface TreatmentActionSummary {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
}

export interface TreatmentActionListResult {
  readonly items: readonly ActionRecord[];
  readonly total: number;
}

export abstract class RiskTreatmentActionQueryPort {
  abstract listByRisk(
    riskId: string,
    filters: TreatmentActionListFilters,
    page: number,
    pageSize: number,
  ): Promise<TreatmentActionListResult>;

  abstract summaryByRisk(riskId: string): Promise<TreatmentActionSummary>;
}
