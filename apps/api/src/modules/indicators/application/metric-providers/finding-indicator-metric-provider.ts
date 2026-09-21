/**
 * 009-indicators-reports, T023 — `FINDING_OPEN_COUNT_BY_SEVERITY`.
 * `Finding` is a GRC-kernel capability (`grc/finding`), not a business
 * module — `modules/indicators` (a business module) is explicitly allowed
 * to depend on `grc-domain`/`grc-application` directly (ADR-016,
 * `apps/api/eslint.config.mjs`'s module-isolation policy), the same way
 * `modules/risk`/`modules/audit-engagements` already import `ActionModule`/
 * `FindingModule`. No `shared/grc-ports` boundary port is needed here —
 * only the eight business-module-sourced keys need one.
 *
 * Delegates to `FindingRepositoryPort.list` — the SAME catalog query
 * `GET /findings` already runs. `FindingListFilter.status`/`severity` are
 * both single values (not arrays, unlike `Incident`/`ProblemListFilter`),
 * so this reads one page per `(status, severity)` combination —
 * `OPEN_FINDING_STATUSES.length` (2) × four severities = eight small,
 * indexed, parallel calls, summed per severity — never a ninth,
 * hand-rolled aggregate query.
 */
import { Injectable } from '@nestjs/common';

import { OPEN_FINDING_STATUSES } from '../../../../grc/finding/domain/finding.entity';
import { FindingRepositoryPort } from '../../../../grc/finding/domain/ports/finding-repository.port';

import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  IndicatorMetricValue,
  ScopedIndicatorMetricProvider,
} from '../../domain/indicator-metric-provider';
import type { FindingSeverity } from '@prisma/client';

const FINDING_SEVERITIES: readonly FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

@Injectable()
export class FindingOpenCountBySeverityProvider implements ScopedIndicatorMetricProvider {
  readonly metricKey = 'FINDING_OPEN_COUNT_BY_SEVERITY' as const;

  constructor(private readonly findingRepository: FindingRepositoryPort) {}

  async computeValue(scope: ScopeFilter): Promise<IndicatorMetricValue> {
    const bySeverity: Record<FindingSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    await Promise.all(
      FINDING_SEVERITIES.flatMap((severity) =>
        OPEN_FINDING_STATUSES.map(async (status) => {
          const page = await this.findingRepository.list(scope, { status, severity }, 1, 1);
          bySeverity[severity] += page.total;
        }),
      ),
    );

    return { shape: 'BY_BUCKET', valueByBucket: bySeverity };
  }
}
