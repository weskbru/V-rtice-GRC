import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import {
  registerAttachableEntityType,
  registerCommentableEntityType,
} from '../../core/comments/domain/entity-registry';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { ActionModule } from '../../grc/action/action.module';
import { registerActionOriginResolver } from '../../grc/shared/domain/ports/action-origin-resolver.port';
import { registerEvidenceSubjectResolver } from '../../grc/shared/domain/ports/evidence-subject-resolver.port';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { IncidentRiskLinkReadModule } from '../incidents/incident-risk-link-read.module';
import { ProblemRiskLinkReadModule } from '../problems/problem-risk-link-read.module';

import { DecideApprovalUseCase } from './application/approvals/decide-approval.usecase';
import { RequestApprovalUseCase } from './application/approvals/request-approval.usecase';
import { RiskActionOriginAccessor } from './application/collaboration/risk-action-origin-accessor';
import {
  RiskEvidenceSubjectAccessor,
  RiskTreatmentDecisionEvidenceSubjectAccessor,
} from './application/collaboration/risk-evidence-subject-accessor';
import { RiskParentRecordAccessor } from './application/collaboration/risk-parent-record-accessor';
import { CreateAssessmentUseCase } from './application/create-assessment.usecase';
import { CreateRiskUseCase } from './application/create-risk.usecase';
import { GetDashboardUseCase } from './application/get-dashboard.usecase';
import { GetRiskDetailUseCase } from './application/get-risk-detail.usecase';
import { GetRiskHistoryUseCase } from './application/get-risk-history.usecase';
import { GetRiskUseCase } from './application/get-risk.usecase';
import { GetRiskLifecycleUseCase } from './application/lifecycle/get-risk-lifecycle.usecase';
import { LinkAssetUseCase, UnlinkAssetUseCase } from './application/links/asset-link.usecase';
import { LinkControlUseCase, UnlinkControlUseCase } from './application/links/control-link.usecase';
import {
  ListRiskIncidentLinksUseCase,
  ListRiskProblemLinksUseCase,
} from './application/links/list-risk-incident-problem-links.usecase';
import { LinkProcessUseCase, UnlinkProcessUseCase } from './application/links/process-link.usecase';
import { ListRiskAuditEventsUseCase } from './application/list-risk-audit-events.usecase';
import { ListRiskReferenceDataUseCase } from './application/list-risk-reference-data.usecase';
import { ListRisksUseCase } from './application/list-risks.usecase';
import { MethodologyQueryUseCase } from './application/methodology-query.usecase';
import { PerformTransitionUseCase } from './application/perform-transition.usecase';
import { PublishMethodologyVersionUseCase } from './application/publish-methodology-version.usecase';
import { RecordTreatmentUseCase } from './application/record-treatment.usecase';
import { ReplaceRiskStatementsUseCase } from './application/replace-risk-statements.usecase';
import { CreateTreatmentActionUseCase } from './application/treatment-actions/create-treatment-action.usecase';
import { UpdateTreatmentActionUseCase } from './application/treatment-actions/update-treatment-action.usecase';
import { UpdateRiskUseCase } from './application/update-risk.usecase';
import { ApprovalRepositoryPort } from './domain/ports/approval-repository.port';
import { DashboardQueryPort } from './domain/ports/dashboard-query.port';
import { RiskAssessmentRepositoryPort } from './domain/ports/risk-assessment-repository.port';
import { RiskCodeGeneratorPort } from './domain/ports/risk-code-generator.port';
import { RiskHistoryQueryPort } from './domain/ports/risk-history-query.port';
import { RiskLifecycleTransitionRepositoryPort } from './domain/ports/risk-lifecycle-transition-repository.port';
import { RiskMethodologyRepositoryPort } from './domain/ports/risk-methodology-repository.port';
import { RiskQueryPort } from './domain/ports/risk-query.port';
import { RiskReferenceDataPort } from './domain/ports/risk-reference-data.port';
import {
  RiskAssetLinkRepositoryPort,
  RiskControlLinkRepositoryPort,
  RiskProcessLinkRepositoryPort,
} from './domain/ports/risk-relationship-repository.port';
import { RiskRepositoryPort } from './domain/ports/risk-repository.port';
import { RiskTreatmentActionQueryPort } from './domain/ports/risk-treatment-action-query.port';
import { RiskTreatmentActionRepositoryPort } from './domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from './domain/ports/risk-treatment-decision-repository.port';
import { registerRiskAuditAllowlists } from './domain/risk-audit-allowlist';
import { ApprovalRepository } from './infrastructure/approval.repository';
import { DashboardQueryService } from './infrastructure/dashboard-query.service';
import { PrismaRiskCodeGenerator } from './infrastructure/prisma-risk-code-generator';
import { PrismaRiskReferenceDataRepository } from './infrastructure/prisma-risk-reference-data.repository';
import {
  PrismaRiskAssetLinkRepository,
  PrismaRiskControlLinkRepository,
  PrismaRiskProcessLinkRepository,
} from './infrastructure/prisma-risk-relationship.repository';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { RiskAssessmentRepository } from './infrastructure/risk-assessment.repository';
import { RiskHistoryQueryService } from './infrastructure/risk-history.service';
import { RiskLifecycleTransitionRepository } from './infrastructure/risk-lifecycle-transition.repository';
import { RiskMethodologyRepository } from './infrastructure/risk-methodology.repository';
import { RiskQueryService } from './infrastructure/risk-query.service';
import { RiskTreatmentActionQueryService } from './infrastructure/risk-treatment-action-query.service';
import { RiskTreatmentActionRepository } from './infrastructure/risk-treatment-action.repository';
import { RiskTreatmentDecisionRepository } from './infrastructure/risk-treatment-decision.repository';
import { RiskRepository } from './infrastructure/risk.repository';
import { AssessmentController } from './presentation/assessment.controller';
import { AuditController } from './presentation/audit.controller';
import { DashboardController } from './presentation/dashboard.controller';
import { HistoryController } from './presentation/history.controller';
import { LifecycleController } from './presentation/lifecycle.controller';
import { MethodologyController } from './presentation/methodology.controller';
import { RiskReferenceDataController } from './presentation/risk-reference-data.controller';
import { RiskRelationshipController } from './presentation/risk-relationship.controller';
import { RiskController } from './presentation/risk.controller';
import { TreatmentController } from './presentation/treatment.controller';
import { RiskControlLinkReadModule } from './risk-control-link-read.module';
import { RiskDashboardMetricsModule } from './risk-dashboard-metrics.module';
import { RiskDirectoryModule } from './risk-directory.module';

let collaborationEntityTypesRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ActionModule,
    RiskControlLinkReadModule,
    // Expõe os provedores globais.
    IncidentRiskLinkReadModule,
    ProblemRiskLinkReadModule,
    RiskDirectoryModule,
    RiskDashboardMetricsModule,
  ],
  controllers: [
    RiskController,
    RiskReferenceDataController,
    AssessmentController,
    MethodologyController,
    TreatmentController,
    RiskRelationshipController,
    LifecycleController,
    HistoryController,
    AuditController,
    DashboardController,
  ],
  providers: [
    CreateRiskUseCase,
    GetDashboardUseCase,
    GetRiskUseCase,
    GetRiskDetailUseCase,
    UpdateRiskUseCase,
    ListRisksUseCase,
    ReplaceRiskStatementsUseCase,
    ListRiskReferenceDataUseCase,
    CreateAssessmentUseCase,
    MethodologyQueryUseCase,
    PublishMethodologyVersionUseCase,
    RecordTreatmentUseCase,
    CreateTreatmentActionUseCase,
    UpdateTreatmentActionUseCase,
    LinkControlUseCase,
    UnlinkControlUseCase,
    LinkProcessUseCase,
    UnlinkProcessUseCase,
    LinkAssetUseCase,
    UnlinkAssetUseCase,
    ListRiskIncidentLinksUseCase,
    ListRiskProblemLinksUseCase,
    PerformTransitionUseCase,
    RequestApprovalUseCase,
    DecideApprovalUseCase,
    GetRiskLifecycleUseCase,
    GetRiskHistoryUseCase,
    ListRiskAuditEventsUseCase,
    RiskParentRecordAccessor,
    RiskEvidenceSubjectAccessor,
    RiskTreatmentDecisionEvidenceSubjectAccessor,
    RiskActionOriginAccessor,
    { provide: RiskRepositoryPort, useClass: RiskRepository },
    { provide: RiskHistoryQueryPort, useClass: RiskHistoryQueryService },
    { provide: RiskQueryPort, useClass: RiskQueryService },
    { provide: DashboardQueryPort, useClass: DashboardQueryService },
    { provide: RiskReferenceDataPort, useClass: PrismaRiskReferenceDataRepository },
    { provide: RiskCodeGeneratorPort, useClass: PrismaRiskCodeGenerator },
    { provide: RiskAssessmentRepositoryPort, useClass: RiskAssessmentRepository },
    { provide: RiskMethodologyRepositoryPort, useClass: RiskMethodologyRepository },
    { provide: RiskTreatmentDecisionRepositoryPort, useClass: RiskTreatmentDecisionRepository },
    { provide: RiskTreatmentActionRepositoryPort, useClass: RiskTreatmentActionRepository },
    { provide: RiskTreatmentActionQueryPort, useClass: RiskTreatmentActionQueryService },
    { provide: RiskControlLinkRepositoryPort, useClass: PrismaRiskControlLinkRepository },
    { provide: RiskProcessLinkRepositoryPort, useClass: PrismaRiskProcessLinkRepository },
    { provide: RiskAssetLinkRepositoryPort, useClass: PrismaRiskAssetLinkRepository },
    { provide: RiskLifecycleTransitionRepositoryPort, useClass: RiskLifecycleTransitionRepository },
    { provide: ApprovalRepositoryPort, useClass: ApprovalRepository },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
  ],
})
export class RiskModule {
  constructor(
    riskParentRecordAccessor: RiskParentRecordAccessor,
    riskEvidenceSubjectAccessor: RiskEvidenceSubjectAccessor,
    riskTreatmentDecisionEvidenceSubjectAccessor: RiskTreatmentDecisionEvidenceSubjectAccessor,
    riskActionOriginAccessor: RiskActionOriginAccessor,
  ) {
    registerRiskAuditAllowlists();

    if (!collaborationEntityTypesRegistered) {
      collaborationEntityTypesRegistered = true;
      registerAttachableEntityType('RISK', riskParentRecordAccessor);
      registerCommentableEntityType('RISK', riskParentRecordAccessor);

      registerEvidenceSubjectResolver('RISK', riskEvidenceSubjectAccessor);
      registerEvidenceSubjectResolver(
        'RISK_TREATMENT_DECISION',
        riskTreatmentDecisionEvidenceSubjectAccessor,
      );

      registerActionOriginResolver('RISK_TREATMENT', riskActionOriginAccessor);
    }
  }
}
