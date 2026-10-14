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
  imports: [PrismaModule, AuthorizationModule, AuditModule, OrganizationsModule, IndicatorsModule],
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
    registerReportAuditAllowlists();
  }
}
