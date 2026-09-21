/**
 * 009-indicators-reports, Fase 4 (T036) — `ListIndicatorMeasurementsUseCase`
 * (`listIndicatorMeasurements`, spec.md FR-014/FR-015, research.md D-6).
 * Reads the organization-wide historical series for a metric key, oldest
 * first, paginated by `computedAt`.
 *
 * Same double gate as `CreateIndicatorMeasurementUseCase` (T035, see that
 * file's own header for the full reasoning): `indicator:view` is enforced
 * by `PermissionGuard` at the controller, and this use case enforces the
 * REST of FR-014 — the caller's resolved `ScopeFilter` must be
 * `{ kind: 'GLOBAL' }`, checked FIRST, before the `metricKey` is even
 * validated against the catalog and therefore before
 * `IndicatorMeasurementRepositoryPort.list` is ever called.
 *
 * Never stored, never re-derived: `breached` on every item returned here is
 * read back exactly as `CreateIndicatorMeasurementUseCase` persisted it —
 * this use case performs no calculation of any kind (contrast
 * `GetIndicatorCurrentValueUseCase`, which recomputes on every call).
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorMeasurementRepositoryPort } from '../domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { resolveIndicatorComputedByRef } from './resolve-indicator-owner';

import type { IndicatorOwnerRef } from './resolve-indicator-owner';
import type { IndicatorMeasurementRecord } from '../domain/indicator-measurement.entity';

export interface ListIndicatorMeasurementsInput {
  readonly actorUserId: string;
  /** Raw path segment — validated against the closed catalog INSIDE this
   * use case, hence `string`, not `IndicatorMetricKey`. */
  readonly metricKey: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface IndicatorMeasurementWithComputedByRef {
  readonly record: IndicatorMeasurementRecord;
  readonly computedBy: IndicatorOwnerRef;
}

export interface ListIndicatorMeasurementsResult {
  readonly items: readonly IndicatorMeasurementWithComputedByRef[];
  readonly total: number;
}

@Injectable()
export class ListIndicatorMeasurementsUseCase {
  constructor(
    private readonly measurementRepository: IndicatorMeasurementRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListIndicatorMeasurementsInput): Promise<ListIndicatorMeasurementsResult> {
    // research.md D-6 — checked FIRST, before the catalog and before the
    // measurement table is ever read. Mirrors
    // `CreateIndicatorMeasurementUseCase`'s own ordering exactly.
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    if (scope.kind !== 'GLOBAL') {
      throw new ForbiddenDomainError(USER_MESSAGES.indicators.measurementRequiresGlobalScope);
    }

    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    const page = await this.measurementRepository.list({
      metricKey: catalogEntry.metricKey,
      page: input.page,
      pageSize: input.pageSize,
    });

    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        computedBy: await resolveIndicatorComputedByRef(
          this.referenceData,
          record.computedByUserId,
        ),
      })),
    );

    return { items, total: page.total };
  }
}
