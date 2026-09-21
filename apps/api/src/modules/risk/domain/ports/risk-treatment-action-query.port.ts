/**
 * 007-implementation-remediation, Frente A, D-2/D-7 — read-model port for a
 * risk's treatment actions, backed by `RiskTreatmentActionQueryService`
 * (`infrastructure/risk-treatment-action-query.service.ts`). Application
 * and presentation layers depend on THIS abstract class, never on the
 * concrete infrastructure service directly (ADR-011/boundary lint) — same
 * shape as `RiskQueryPort`/`RiskQueryService` elsewhere in this module.
 */
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
