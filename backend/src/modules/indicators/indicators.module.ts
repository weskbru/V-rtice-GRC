import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { registerCommentableEntityType } from '../../core/comments/domain/entity-registry';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { ActionModule } from '../../grc/action/action.module';
import { FindingModule } from '../../grc/finding/finding.module';
import { registerActionOriginResolver } from '../../grc/shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AssetMetricsModule } from '../assets/asset-metrics.module';
import { AuditEngagementMetricsModule } from '../audit-engagements/audit-engagement-metrics.module';
import { ComplianceSummaryModule } from '../compliance/compliance-summary.module';
import { ControlMetricsModule } from '../controls/control-metrics.module';
import { IncidentMetricsModule } from '../incidents/incident-metrics.module';
import { ProblemMetricsModule } from '../problems/problem-metrics.module';
import { ProcessMetricsModule } from '../processes/process-metrics.module';
import { RiskDashboardMetricsModule } from '../risk/risk-dashboard-metrics.module';

import { IndicatorActionOriginAccessor } from './application/collaboration/indicator-action-origin-accessor';
import { IndicatorParentRecordAccessor } from './application/collaboration/indicator-parent-record-accessor';
import { CreateIndicatorDefinitionUseCase } from './application/create-indicator-definition.usecase';
import { CreateIndicatorMeasurementUseCase } from './application/create-indicator-measurement.usecase';
import { GetIndicatorCurrentValueUseCase } from './application/get-indicator-current-value.usecase';
import { GetIndicatorDefinitionUseCase } from './application/get-indicator-definition.usecase';
import { IndicatorCalculationService } from './application/indicator-calculation.service';
import { ListIndicatorDefinitionsUseCase } from './application/list-indicator-definitions.usecase';
import { ListIndicatorMeasurementsUseCase } from './application/list-indicator-measurements.usecase';
import { ListIndicatorMetricKeysUseCase } from './application/list-indicator-metric-keys.usecase';
import { ActionOverdueCountProvider } from './application/metric-providers/action-indicator-metric-provider';
import { AssetInactiveCountProvider } from './application/metric-providers/asset-indicator-metric-provider';
import { AuditEngagementOpenCountProvider } from './application/metric-providers/audit-engagement-indicator-metric-provider';
import { CompliancePercentageProvider } from './application/metric-providers/compliance-indicator-metric-provider';
import { ControlInactiveCountProvider } from './application/metric-providers/control-indicator-metric-provider';
import { FindingOpenCountBySeverityProvider } from './application/metric-providers/finding-indicator-metric-provider';
import { IncidentOpenCountBySeverityProvider } from './application/metric-providers/incident-indicator-metric-provider';
import { ProblemOpenCountBySeverityProvider } from './application/metric-providers/problem-indicator-metric-provider';
import { ProcessInactiveCountProvider } from './application/metric-providers/process-indicator-metric-provider';
import {
  RiskTotalByLevelProvider,
  RiskTreatmentOverdueCountProvider,
} from './application/metric-providers/risk-indicator-metric-provider';
import { UpdateIndicatorDefinitionUseCase } from './application/update-indicator-definition.usecase';
import { registerIndicatorAuditAllowlists } from './domain/indicator-audit-allowlist';
import { IndicatorDefinitionRepositoryPort } from './domain/ports/indicator-definition-repository.port';
import { IndicatorMeasurementRepositoryPort } from './domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from './domain/ports/indicator-reference-data.port';
import { PrismaIndicatorDefinitionRepository } from './infrastructure/prisma-indicator-definition.repository';
import { PrismaIndicatorMeasurementRepository } from './infrastructure/prisma-indicator-measurement.repository';
import { PrismaIndicatorReferenceDataRepository } from './infrastructure/prisma-indicator-reference-data.repository';
import { IndicatorController } from './presentation/indicator.controller';

let commentableRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    AuditModule,
    NotificationsModule,
    OrganizationsModule,
    FindingModule,
    ActionModule,
    RiskDashboardMetricsModule,
    ControlMetricsModule,
    AuditEngagementMetricsModule,
    AssetMetricsModule,
    ProcessMetricsModule,
    IncidentMetricsModule,
    ProblemMetricsModule,
    ComplianceSummaryModule,
  ],
  controllers: [IndicatorController],
  providers: [
    IndicatorParentRecordAccessor,
    IndicatorActionOriginAccessor,
    ListIndicatorDefinitionsUseCase,
    CreateIndicatorDefinitionUseCase,
    GetIndicatorCurrentValueUseCase,
    CreateIndicatorMeasurementUseCase,
    ListIndicatorMeasurementsUseCase,
    ListIndicatorMetricKeysUseCase,
    GetIndicatorDefinitionUseCase,
    UpdateIndicatorDefinitionUseCase,
    {
      provide: IndicatorDefinitionRepositoryPort,
      useClass: PrismaIndicatorDefinitionRepository,
    },
    {
      provide: IndicatorMeasurementRepositoryPort,
      useClass: PrismaIndicatorMeasurementRepository,
    },
    { provide: IndicatorReferenceDataPort, useClass: PrismaIndicatorReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
    RiskTotalByLevelProvider,
    RiskTreatmentOverdueCountProvider,
    ControlInactiveCountProvider,
    AuditEngagementOpenCountProvider,
    FindingOpenCountBySeverityProvider,
    AssetInactiveCountProvider,
    ProcessInactiveCountProvider,
    ActionOverdueCountProvider,
    IncidentOpenCountBySeverityProvider,
    ProblemOpenCountBySeverityProvider,
    CompliancePercentageProvider,
    IndicatorCalculationService,
  ],
  exports: [IndicatorDefinitionRepositoryPort, IndicatorCalculationService],
})
export class IndicatorsModule {
  constructor(
    private readonly parentRecordAccessor: IndicatorParentRecordAccessor,
    private readonly actionOriginAccessor: IndicatorActionOriginAccessor,
  ) {
    registerIndicatorAuditAllowlists();

    if (!commentableRegistered) {
      commentableRegistered = true;

      registerCommentableEntityType('INDICATOR', this.parentRecordAccessor);

      registerActionOriginResolver('INDICATOR', this.actionOriginAccessor);
    }
  }
}
