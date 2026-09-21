/**
 * `DashboardSummaryModule` — the cross-domain dashboard summary's own
 * composition root. Sits directly under `src/modules/dashboard/`, outside
 * the `domain`/`application`/`presentation` folders the boundary lint
 * rules classify (`apps/api/eslint.config.mjs`'s `composition` file
 * category — one file directly under each module's own root, the same
 * pattern `reports.module.ts` itself matches) — the same reasoning that
 * file's own header gives for its identical `IndicatorCalculationPort`
 * binding.
 *
 * Named `DashboardSummaryModule`, not `DashboardModule`: `core/dashboard`
 * already owns that name for the planned-area registry
 * (`core/dashboard/dashboard.module.ts`) that backs `GET /dashboard`'s own
 * `plannedAreas` — a different capability, unrelated to this one, and the
 * two must not be confused by name.
 *
 * ## `IndicatorsModule` imported directly, never relied on via `@Global()`
 *
 * `GetDashboardSummaryUseCase` needs `IndicatorCalculationService` — but
 * `modules/dashboard/**` may not import `modules/indicators/**` directly
 * (module-isolation boundary, the identical constraint
 * `reports.module.ts`'s own header documents crossing for the same
 * reason). This composition file is the one place allowed to reach across
 * that boundary, so it is where `IndicatorCalculationPort`
 * (`shared/grc-ports/indicator-calculation.port.ts`) gets bound — via the
 * SAME `useFactory` shape `reports.module.ts` already uses, built from
 * `IndicatorsModule`'s own exported `IndicatorCalculationService` plus its
 * exported, read-only `INDICATOR_METRIC_CATALOG` domain data. Nothing
 * under `modules/indicators/**` is edited to make this possible.
 *
 * `IndicatorsModule` is listed in `imports` below EXPLICITLY (CLAUDE.md
 * §19.10) — a partial Nest test context that never imports
 * `IndicatorsModule` anywhere else would otherwise fail to resolve
 * `IndicatorCalculationService` here.
 *
 * No `AuditModule` import: this module performs no writes and reads are
 * not audited (ADR-005) — the identical choice `modules/risk`'s own
 * `GetDashboardUseCase` makes for `GET /dashboard`.
 *
 * ## `breakdowns` — six more cross-module dependencies, each imported the
 * ## same explicit way (CLAUDE.md §19.10)
 *
 * `ActionModule` (`grc/action`, ADR-016 — a GRC-kernel capability this
 * module may depend on directly) plus five tiny boundary-port modules this
 * use case's own header names (`IncidentMetricsModule`,
 * `ProblemMetricsModule`, `ControlMetricsModule`, `ComplianceSummaryModule`,
 * `IndicatorMonitoringModule`) are imported here explicitly, exactly like
 * `IndicatorsModule` already is above — never relied on via `@Global()`
 * provider visibility that only holds when something else happened to
 * import the owning module first.
 */
import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { ActionModule } from '../../grc/action/action.module';
import { IndicatorCalculationPort } from '../../shared/grc-ports/indicator-calculation.port';
import { ComplianceSummaryModule } from '../compliance/compliance-summary.module';
import { ControlMetricsModule } from '../controls/control-metrics.module';
import { IncidentMetricsModule } from '../incidents/incident-metrics.module';
import { IndicatorCalculationService } from '../indicators/application/indicator-calculation.service';
import { getIndicatorMetricCatalogEntry } from '../indicators/domain/indicator-metric-catalog';
import { IndicatorMonitoringModule } from '../indicators/indicator-monitoring.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { ProblemMetricsModule } from '../problems/problem-metrics.module';

import { GetDashboardSummaryUseCase } from './application/get-dashboard-summary.usecase';
import { DashboardSummaryController } from './presentation/dashboard-summary.controller';

import type { IndicatorCalculationPortResult } from '../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

@Module({
  imports: [
    AuthorizationModule,
    OrganizationsModule,
    // See this file's own header for why this is imported directly rather
    // than relied on via `@Global()`.
    IndicatorsModule,
    ActionModule,
    IncidentMetricsModule,
    ProblemMetricsModule,
    ControlMetricsModule,
    ComplianceSummaryModule,
    IndicatorMonitoringModule,
  ],
  controllers: [DashboardSummaryController],
  providers: [
    GetDashboardSummaryUseCase,
    {
      provide: IndicatorCalculationPort,
      useFactory: (calculationService: IndicatorCalculationService) => ({
        getMetadata: (metricKey: IndicatorMetricKey) => {
          const entry = getIndicatorMetricCatalogEntry(metricKey);
          return {
            sourcePermission: entry.sourcePermission,
            scopeApplicability: entry.scopeApplicability,
          };
        },
        calculate: (input: {
          metricKey: IndicatorMetricKey;
          scope: ScopeFilter;
        }): Promise<IndicatorCalculationPortResult> =>
          calculationService.calculate({ ...input, definition: undefined }),
      }),
      inject: [IndicatorCalculationService],
    },
  ],
})
export class DashboardSummaryModule {}
