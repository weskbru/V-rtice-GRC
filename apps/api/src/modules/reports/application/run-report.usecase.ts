/**
 * 009-indicators-reports, Fase 7 (T052) — `RunReportUseCase` (`runReport`,
 * spec.md FR-025/FR-026/FR-027, contracts/reports.openapi.yaml).
 *
 * ## FR-026 / SC-006 — the one place a per-item authorization failure never
 * ## fails the whole operation
 *
 * Every other per-item authorization check in this platform throws and
 * fails the whole request — `GetIndicatorCurrentValueUseCase`'s own
 * `ForbiddenDomainError` for a single key is the direct precedent this use
 * case deliberately does NOT follow here (that use case's own header:
 * there is no "other items" for a standalone indicator to preserve). Here,
 * a missing source permission for one `metricKey` marks ONLY that item
 * `available: false` — value/`valueByBucket` absent, never a zeroed
 * number — and the loop continues; the other items are computed and
 * returned normally. `report:view` itself (this operation's own top-level
 * permission) is checked by `PermissionGuard` before this use case ever
 * runs (out of this task's scope, T054) — this use case starts from an
 * already-authorized caller and is responsible only for each item's own
 * `sourcePermission` (FR-026). Proven by
 * `test/unit/run-report.usecase.spec.ts`'s "three keys, one forbidden"
 * case.
 *
 * Scope is resolved EXACTLY ONCE (`ScopeResolverService.resolveScope`) and
 * forwarded to every item — the same "resolve escopo uma vez" pattern
 * FR-006 already establishes for a single indicator, applied here across
 * the whole report (FR-027: a report execution is never stored, always
 * recomputed under the caller's own scope).
 *
 * Every value comes from `IndicatorCalculationPort.calculate` — the SAME
 * `IndicatorCalculationService` US1 uses, reached through the module
 * boundary port `shared/grc-ports/indicator-calculation.port.ts` documents
 * (never a second calculation, FR-025, CLAUDE.md §19.7).
 *
 * Items are returned in `definition.metricKeys`' own declared order
 * (`Promise.all` over `.map`, which preserves array order) — the same
 * order `contracts/reports.openapi.yaml`'s CSV export
 * (`ExportReportCsvUseCase`, T053) relies on.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { IndicatorCalculationPort } from '../../../shared/grc-ports/indicator-calculation.port';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { IndicatorMetricScopeApplicability } from '../../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

export interface RunReportInput {
  readonly actorUserId: string;
  readonly reportId: string;
}

export interface ReportRunItemResult {
  readonly metricKey: IndicatorMetricKey;
  readonly label: string;
  /** `false` when the caller lacks this metric's own source read
   * permission (FR-026) — `value`/`valueByBucket` are absent in that case,
   * never a zeroed number. */
  readonly available: boolean;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  readonly value: number | undefined;
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export interface RunReportResult {
  readonly reportId: string;
  readonly computedAt: Date;
  readonly items: readonly ReportRunItemResult[];
}

@Injectable()
export class RunReportUseCase {
  constructor(
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly indicatorCalculation: IndicatorCalculationPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: RunReportInput): Promise<RunReportResult> {
    const definition = await this.definitionRepository.findById(input.reportId);
    if (!definition) {
      throw new NotFoundDomainError(USER_MESSAGES.reports.entityLabel, input.reportId);
    }

    // FR-027 — resolved once, forwarded to every item below, never cached
    // across calls.
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const items = await Promise.all(
      definition.metricKeys.map((metricKey) =>
        this.evaluateItem(metricKey, input.actorUserId, scope),
      ),
    );

    return {
      reportId: definition.id,
      computedAt: new Date(),
      items,
    };
  }

  /** One `metricKey`'s own item — FR-026's per-item gate. Never throws for
   * a missing source permission; a missing report (checked in `execute`
   * above) is the only condition this whole operation still fails on. */
  private async evaluateItem(
    metricKey: IndicatorMetricKey,
    actorUserId: string,
    scope: ScopeFilter,
  ): Promise<ReportRunItemResult> {
    const label = USER_MESSAGES.indicators.metricKeyLabels[metricKey];
    const metadata = this.indicatorCalculation.getMetadata(metricKey);
    // See `IndicatorCalculationPort`'s own header for why the port returns
    // `sourcePermission` as `string` and this call site narrows it back —
    // the value always originates from `INDICATOR_METRIC_CATALOG`, itself
    // typed `PermissionIdentifier`.
    const sourcePermission = metadata.sourcePermission as PermissionIdentifier;

    const canView = await this.permissionResolver.hasPermission(actorUserId, sourcePermission);
    if (!canView) {
      // FR-026/SC-006 — marks ONLY this item unavailable. `Promise.all` in
      // `execute` above still awaits every OTHER item's own promise
      // independently, so this never derails them.
      return {
        metricKey,
        label,
        available: false,
        scopeApplicability: metadata.scopeApplicability,
        value: undefined,
        valueByBucket: undefined,
      };
    }

    const result = await this.indicatorCalculation.calculate({ metricKey, scope });

    return {
      metricKey,
      label,
      available: true,
      scopeApplicability: result.scopeApplicability,
      value: result.value,
      valueByBucket: result.valueByBucket,
    };
  }
}
