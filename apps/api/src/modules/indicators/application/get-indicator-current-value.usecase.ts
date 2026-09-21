/**
 * 009-indicators-reports, Fase 3 (T030) — `GetIndicatorCurrentValueUseCase`
 * (`getIndicatorCurrentValue`, spec.md FR-005/FR-006/FR-010). The MVP
 * checkpoint of this feature (tasks.md's own "Fase 3 ... entrega valor
 * demonstrável sozinha").
 *
 * ## The double permission gate (FR-006), and why the order below is not
 * ## arbitrary
 *
 * `indicator:view` is enforced by `PermissionGuard`/`@RequirePermission`
 * on `IndicatorController#getCurrentValue` — BEFORE this use case's
 * `execute` ever runs (contracts/indicators.openapi.yaml's own wording:
 * "Missing the first is `403` before the key is even looked up"). This use
 * case is therefore only ever reached by a caller who already holds
 * `indicator:view`, and is responsible for the REST of FR-006:
 *
 * 1. Resolve the catalog entry for `metricKey` FIRST — an unknown key is
 *    `404` (FR-010), checked before any permission beyond `indicator:view`
 *    can even be named, because `sourcePermission` itself comes from the
 *    catalog entry.
 * 2. Only once the catalog entry is known can the SECOND permission
 *    (`sourcePermission` — e.g. `risk:view` for a Risk-sourced key) be
 *    checked. Missing it is `403`, naming the permission
 *    (`sourcePermissionRequired`), never conflated with "missing
 *    `indicator:view`".
 * 3. The caller's `ScopeFilter` is resolved EXACTLY ONCE
 *    (`ScopeResolverService.resolveScope`) and handed to
 *    `IndicatorCalculationService` regardless of the key's own
 *    `scopeApplicability` — that service, not this use case, decides
 *    whether the scope is forwarded to a provider at all
 *    (`ORGANIZATION_WIDE` vs `ORGANIZATIONAL_UNIT`, research.md D-8).
 *
 * Never stored, never cached across calls — recomputed every time via
 * `IndicatorCalculationService.calculate` (FR-005), the platform's single
 * calculator (CLAUDE.md §19.7).
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { IndicatorCalculationService } from './indicator-calculation.service';
import { resolveIndicatorOwnerRef, type IndicatorOwnerRef } from './resolve-indicator-owner';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../domain/indicator-metric-catalog';
import type { IndicatorMetricKey } from '@prisma/client';

export interface GetIndicatorCurrentValueInput {
  readonly actorUserId: string;
  /** Raw path segment — validated against the closed catalog INSIDE this
   * use case (FR-010), hence `string`, not `IndicatorMetricKey`. */
  readonly metricKey: string;
}

export interface IndicatorDefinitionWithOwnerRef {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

export interface GetIndicatorCurrentValueResult {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
  /** `undefined` when no `IndicatorDefinition` has been configured for this
   * key yet (data-model.md §1 — a definition is optional configuration,
   * FR-001). */
  readonly definition: IndicatorDefinitionWithOwnerRef | undefined;
  readonly computedAt: Date;
}

@Injectable()
export class GetIndicatorCurrentValueUseCase {
  constructor(
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly calculationService: IndicatorCalculationService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: GetIndicatorCurrentValueInput): Promise<GetIndicatorCurrentValueResult> {
    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      // FR-010 — an unknown key is `404`, exactly like an unknown record id
      // elsewhere in this API: the catalog itself is the "record" being
      // looked up (contracts/indicators.openapi.yaml's own description).
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    // FR-006, second half — checked only now that the catalog entry (and
    // therefore its `sourcePermission`) is known.
    const canViewSource = await this.permissionResolver.hasPermission(
      input.actorUserId,
      catalogEntry.sourcePermission,
    );
    if (!canViewSource) {
      throw new ForbiddenDomainError(
        USER_MESSAGES.indicators.sourcePermissionRequired(catalogEntry.sourcePermission),
      );
    }

    const [scope, definitionRecord] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.definitionRepository.findByMetricKey(catalogEntry.metricKey),
    ]);

    const result = await this.calculationService.calculate({
      metricKey: catalogEntry.metricKey,
      scope,
      definition: definitionRecord,
    });

    const definition = definitionRecord
      ? {
          record: definitionRecord,
          owner: await resolveIndicatorOwnerRef(this.referenceData, definitionRecord.ownerUserId),
        }
      : undefined;

    return {
      metricKey: result.metricKey,
      shape: result.shape,
      scopeApplicability: result.scopeApplicability,
      value: result.value,
      valueByBucket: result.valueByBucket,
      definition,
      computedAt: new Date(),
    };
  }
}
