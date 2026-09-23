import { Injectable } from '@nestjs/common';

import { ActionRepositoryPort } from '../../../grc/action/domain/ports/action-repository.port';
import { OVERDUE_ELIGIBLE_ACTION_STATUSES } from '../../../grc/shared/domain/overdue.service';
import { RiskTreatmentActionQueryPort } from '../domain/ports/risk-treatment-action-query.port';

import type {
  TreatmentActionListFilters,
  TreatmentActionListResult,
  TreatmentActionSummary,
} from '../domain/ports/risk-treatment-action-query.port';
import type { ActionStatus } from '@prisma/client';

@Injectable()
export class RiskTreatmentActionQueryService implements RiskTreatmentActionQueryPort {
  constructor(private readonly actionRepository: ActionRepositoryPort) {}

  async listByRisk(
    riskId: string,
    filters: TreatmentActionListFilters,
    page: number,
    pageSize: number,
  ): Promise<TreatmentActionListResult> {
    const result = await this.actionRepository.list(
      { kind: 'UNRESTRICTED' },
      {
        originType: 'RISK_TREATMENT',
        originId: riskId,
        statuses: filters.status,
        overdue: filters.overdue,
      },
      page,
      pageSize,
    );
    return { items: result.items, total: result.total };
  }

  async summaryByRisk(riskId: string): Promise<TreatmentActionSummary> {
    const [total, open, overdue] = await Promise.all([
      this.count(riskId, {}),
      this.count(riskId, { statuses: OVERDUE_ELIGIBLE_ACTION_STATUSES }),
      this.count(riskId, { statuses: OVERDUE_ELIGIBLE_ACTION_STATUSES, overdue: true }),
    ]);
    return { total, open, overdue };
  }

  private async count(
    riskId: string,
    filter: { readonly statuses?: readonly ActionStatus[]; readonly overdue?: boolean },
  ): Promise<number> {
    const result = await this.actionRepository.list(
      { kind: 'UNRESTRICTED' },
      { originType: 'RISK_TREATMENT', originId: riskId, ...filter },
      1,
      1,
    );
    return result.total;
  }
}
