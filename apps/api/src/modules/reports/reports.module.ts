/**
 * 009-indicators-reports, Fase 2 (T014) + Fase 7 (T051-T054) —
 * `ReportsModule`, this module's own composition root. Sits directly under
 * `src/modules/reports/`, outside the `domain`/`application`/
 * `infrastructure`/`presentation` folders the boundary lint rules classify
 * — same reasoning as `IndicatorsModule`'s own header.
 *
 * Fase 2 was foundation only: no controller, no use case, no DTO. Fase 7
 * added `CreateReportDefinitionUseCase`/`RunReportUseCase`/
 * `ExportReportCsvUseCase` (T051-T053), then `ListReportDefinitionsUseCase`
 * and `ReportController` (T054). Fase 8 (T068) adds the contract's two
 * remaining operations — `GetReportDefinitionUseCase`/
 * `UpdateReportDefinitionUseCase` (`getReportDefinition`/
 * `updateReportDefinition`, see `report.controller.ts`'s own header).
 *
 * ## `IndicatorsModule` is imported directly here — never `@Global()`
 *
 * `RunReportUseCase` needs `IndicatorCalculationService` (T029, US1's own
 * single calculator, FR-025/CLAUDE.md §19.7) — but `modules/reports/**`
 * (domain/application/infrastructure/presentation) may not import
 * `modules/indicators/**` directly, the same module-isolation boundary
 * `RiskDashboardMetricsModule`/`ControlMetricsModule` exist to cross for
 * `IndicatorsModule` itself (see each of THEIR own headers). This
 * composition file is the one place allowed to reach across that boundary
 * (`apps/api/eslint.config.mjs`'s `composition` file category), so it is
 * where `IndicatorCalculationPort` (`shared/grc-ports/
 * indicator-calculation.port.ts`) gets bound — via a `useFactory` provider
 * built directly from `IndicatorsModule`'s own EXPORTED
 * `IndicatorCalculationService` plus its EXPORTED, read-only
 * `INDICATOR_METRIC_CATALOG` domain data. Nothing under
 * `modules/indicators/**` is edited to make this possible — both symbols
 * were already public.
 *
 * `IndicatorsModule` is listed in `imports` below EXPLICITLY, not relied on
 * via `@Global()` provider visibility from some other module having
 * imported it first — the same discipline `IndicatorsModule`'s own header
 * documents adopting for its own eight `*MetricsModule` imports (commit
 * `8135915`): a partial Nest test context that never imports
 * `IndicatorsModule` anywhere else would otherwise fail to resolve
 * `IndicatorCalculationService` here, the exact CLAUDE.md §19.10 failure
 * mode that commit fixed for the other direction.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IndicatorCalculationPort } from '../../shared/grc-ports/indicator-calculation.port';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { IndicatorCalculationService } from '../indicators/application/indicator-calculation.service';
import { getIndicatorMetricCatalogEntry } from '../indicators/domain/indicator-metric-catalog';
import { IndicatorsModule } from '../indicators/indicators.module';

import { CreateReportDefinitionUseCase } from './application/create-report-definition.usecase';
import { ExportReportCsvUseCase } from './application/export-report-csv.usecase';
import { GetReportDefinitionUseCase } from './application/get-report-definition.usecase';
import { ListReportDefinitionsUseCase } from './application/list-report-definitions.usecase';
import { RunReportUseCase } from './application/run-report.usecase';
import { UpdateReportDefinitionUseCase } from './application/update-report-definition.usecase';
import { ReportDefinitionRepositoryPort } from './domain/ports/report-definition-repository.port';
import { ReportReferenceDataPort } from './domain/ports/report-reference-data.port';
import { registerReportAuditAllowlists } from './domain/report-audit-allowlist';
import { PrismaReportDefinitionRepository } from './infrastructure/prisma-report-definition.repository';
import { PrismaReportReferenceDataRepository } from './infrastructure/prisma-report-reference-data.repository';
import { ReportController } from './presentation/report.controller';

import type { IndicatorCalculationPortResult } from '../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../shared/persistence/scope-filter';
import type { IndicatorMetricKey } from '@prisma/client';

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    AuditModule,
    OrganizationsModule,
    // T052 — see this file's own header for why this is imported directly
    // rather than relied on via `@Global()`.
    IndicatorsModule,
  ],
  controllers: [ReportController],
  providers: [
    ListReportDefinitionsUseCase,
    CreateReportDefinitionUseCase,
    GetReportDefinitionUseCase,
    UpdateReportDefinitionUseCase,
    RunReportUseCase,
    ExportReportCsvUseCase,
    {
      provide: ReportDefinitionRepositoryPort,
      useClass: PrismaReportDefinitionRepository,
    },
    { provide: ReportReferenceDataPort, useClass: PrismaReportReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
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
  exports: [ReportDefinitionRepositoryPort],
})
export class ReportsModule {
  constructor() {
    // Registers this module's own `AuditEntityType.REPORT` field
    // allow-list (T011) from its own file, without editing `core/audit/**`
    // (ADR-011) — mirrors `IndicatorsModule`'s own
    // `registerIndicatorAuditAllowlists()` call.
    registerReportAuditAllowlists();
  }
}
