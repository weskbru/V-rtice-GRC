/**
 * 007-implementation-remediation, Frente A, D-2/D-7 — reads a risk's
 * treatment actions from the SHARED `ActionRepositoryPort.list()`
 * (`grc/action`, a domain-layer port — never `PrismaService` directly),
 * scoped by `originType = RISK_TREATMENT` / `originId = riskId`
 * (research.md D-7), INCLUDING an `Action` with no `risk_treatment_actions`
 * link row (D-2 — the three previously-invisible actions this convergence
 * exists to surface). `RiskTreatmentActionRepositoryPort` (D-1) only
 * manages the link table itself and is not the read path for a listing.
 *
 * Depends only on `ActionRepositoryPort` (`grc-domain`), never on
 * `grc/action/infrastructure` directly — the boundary rule
 * (`modules/* -> grc/*` restricted to `domain`/`application` for
 * non-composition files) forbids the latter, and this port already gives
 * everything needed: origin filtering, multi-status filtering and the
 * SAME shared overdue predicate every other `Action` listing uses.
 *
 * `OVERDUE_ELIGIBLE_ACTION_STATUSES` below is imported, not restated —
 * coordinator correction: this file originally declared its OWN local copy
 * (`OVERDUE_ELIGIBLE_STATUSES`) of `grc/shared/domain/overdue.service.ts`'s
 * status set, which was a NEW instance of the exact duplication this front
 * exists to remove, introduced by this front itself. `grc/shared/domain`
 * is `grc-domain` (capability `shared`), and `grc-domain` of any capability
 * is one of the two element types `modules/*` may reach — the same rule
 * this file already imports `ActionRepositoryPort` (capability `action`)
 * under.
 */
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
    // `pageSize: 1` — only `.total` is read; the single row itself is
    // discarded. `ActionRepositoryPort` has no dedicated `count`, and
    // adding one for a single call site is not justified yet (CLAUDE.md
    // §2: no premature abstraction) — revisit if a second summary-only
    // caller appears.
    const result = await this.actionRepository.list(
      { kind: 'UNRESTRICTED' },
      { originType: 'RISK_TREATMENT', originId: riskId, ...filter },
      1,
      1,
    );
    return result.total;
  }
}
