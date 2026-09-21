/**
 * `RiskModule` — the Risk Management module's composition root (T086-T092,
 * US2). Sits directly under `src/modules/risk/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify (exactly like every core capability's own
 * `*.module.ts`) — the one place allowed to wire a domain port to its
 * infrastructure implementation and to import `AuditModule`/
 * `OrganizationsModule` directly.
 *
 * `modules/risk/**` never imports another business module (there are none
 * yet) and `core/**` never imports `modules/risk/**` — this module only
 * depends INTO `core/**` (`AuditModule`, `OrganizationsModule`,
 * `PrismaModule`), matching CLAUDE.md's inviolable rule 1 and ADR-011.
 */
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

// `RiskModule`'s constructor runs every time a NestJS testing module
// instantiates it — several `test/integration/**` specs each build their
// OWN minimal testing module importing `RiskModule` directly rather than
// sharing one `AppModule` instance across the whole process (see e.g.
// `test/integration/support/test-app.ts`). `registerAttachableEntityType`/
// `registerCommentableEntityType` throw on a second registration by design
// (a genuine double-registration is a configuration bug — see
// `entity-registry.ts`), so this module-level flag is required for the
// SAME reason `registerRiskAuditAllowlists`'s own internal flag exists:
// idempotent across repeated construction within one process, never
// silently allowing a real second module to overwrite the first.
let collaborationEntityTypesRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ActionModule,
    // ADR-020 part 3, reverse direction — `RiskControlLinkReadModule`
    // (`@Global()`) binds `RiskControlLinkReadPort` to this module's own
    // `PrismaRiskControlLinkReadAdapter`, which lets `modules/controls`'s
    // `ListControlRiskLinksUseCase` inject that port without either module
    // importing the other. The mirror of `ControlsModule` importing
    // `ControlDirectoryModule` for the opposite direction. Unlike
    // `IncidentRiskLinkReadModule`/`ProblemRiskLinkReadModule` below,
    // `ControlRelationshipModule` cannot import this module directly —
    // `controls-risk-module-boundary.spec.ts` (SC-007) forbids any file
    // under `modules/controls` from importing anything under
    // `modules/risk` — so `@Global()` stays here (see this file's own
    // header for the full account).
    RiskControlLinkReadModule,
    // 013-incidents-problems-reverse-links — `IncidentRiskLinkReadModule`/
    // `ProblemRiskLinkReadModule` bind `IncidentRiskLinkReadPort`/
    // `ProblemRiskLinkReadPort` to `modules/incidents`'/`modules/problems`'
    // own adapters. This module imports them directly so
    // `ListRiskIncidentLinksUseCase`/`ListRiskProblemLinksUseCase` (below)
    // can inject those ports without either module importing the other
    // (CLAUDE.md §19.10 — a partial Nest test graph must not depend on
    // global provider visibility).
    IncidentRiskLinkReadModule,
    ProblemRiskLinkReadModule,
    // 005-audit-findings, T013 — `RiskDirectoryModule` (`@Global()`) binds
    // `RiskDirectoryPort` to this module's own `PrismaRiskDirectoryAdapter`,
    // the mirror of `ControlsModule` importing `ControlDirectoryModule`:
    // lets `grc/finding`'s `LinkFindingToRiskUseCase` (Fase 5, out of this
    // task's own scope) inject that port without either side importing the
    // other (ADR-020 part 3, research.md D-4).
    RiskDirectoryModule,
    // 009-indicators-reports, T019 — `RiskDashboardMetricsModule` binds
    // `RiskDashboardMetricsPort` to a fresh `DashboardQueryService`,
    // letting `modules/indicators`'s Risk providers reuse the SAME
    // `getRiskProfile`/`getTreatmentActionsSummary` queries `GET
    // /dashboard` already runs. `IndicatorsModule` imports
    // `RiskDashboardMetricsModule` directly rather than `RiskModule`
    // itself (see `risk-dashboard-metrics.module.ts`'s own header for why
    // it is no longer `@Global()`).
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
    // 013-incidents-problems-reverse-links — read-only reverse of
    // `IncidentRiskLink`/`ProblemRiskLink`, owned by `modules/incidents`/
    // `modules/problems` respectively; injected via
    // `IncidentRiskLinkReadModule`/`ProblemRiskLinkReadModule`, imported
    // directly above.
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
    // T089/T090: register this module's own AuditEntityType.RISK field
    // allow-list from its own file, without editing `core/audit/**`
    // (ADR-011) — the exact extension point
    // `core-entity-audit-allowlists.ts` describes.
    registerRiskAuditAllowlists();

    // T191/US9: register RISK against the attachable/commentable
    // entity-type registry from this module's own composition root,
    // without editing `core/comments/**`/`core/files/**` (ADR-011) — the
    // exact extension point `entity-registry.ts` describes, and F-7's
    // proof that it is real.
    if (!collaborationEntityTypesRegistered) {
      collaborationEntityTypesRegistered = true;
      registerAttachableEntityType('RISK', riskParentRecordAccessor);
      registerCommentableEntityType('RISK', riskParentRecordAccessor);

      // T030/002-shared-grc-foundation, US1 — register RISK and
      // RISK_TREATMENT_DECISION against `EvidenceSubjectResolverPort`'s
      // registry from this SAME composition root, without `grc/**` ever
      // importing `modules/risk` (ADR-016) — the exact extension point
      // `evidence-subject-resolver.port.ts`'s own header describes.
      registerEvidenceSubjectResolver('RISK', riskEvidenceSubjectAccessor);
      registerEvidenceSubjectResolver(
        'RISK_TREATMENT_DECISION',
        riskTreatmentDecisionEvidenceSubjectAccessor,
      );

      // T049/002-shared-grc-foundation, US2 — register RISK_TREATMENT
      // against `ActionOriginResolverPort`'s registry from this SAME
      // composition root, without `grc/**` ever importing `modules/risk`
      // (ADR-016) — the exact extension point
      // `action-origin-resolver.port.ts`'s own header describes.
      registerActionOriginResolver('RISK_TREATMENT', riskActionOriginAccessor);
    }
  }
}
