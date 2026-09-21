/**
 * T018/005-audit-findings — `AuditEngagementsModule`, this module's own
 * composition root. Sits directly under `src/modules/audit-engagements/`,
 * outside the `domain`/`application`/`infrastructure`/`presentation`
 * folders the boundary lint rules classify — exactly like `controls.module.ts`/
 * `compliance.module.ts`, and for the same reason: this is the one place
 * allowed to bind a domain port to its infrastructure implementation
 * (ADR-011).
 *
 * ## What this module owns
 *
 * The engagement itself and its four-state lifecycle, and its scope — the
 * 11 HTTP operations of `contracts/audit.openapi.yaml` (operations 1-10
 * plus the FR-004a-amended `cancelAuditEngagement`, added to the contract
 * alongside this task's own controllers). T040/T041 add the three
 * `presentation/**` controllers below (`AuditEngagementController`,
 * `AuditEngagementScopeController`, `AuditEngagementLifecycleController`)
 * and their DTOs/mappers — every use case below was already fully
 * exercised by `test/integration/**` (T034/T034b/T035-T037) calling it
 * directly through this module's own injector before any HTTP route
 * existed; the controllers are a second, HTTP-facing caller of the SAME
 * use cases, never a parallel code path.
 *
 * T042/T043/005-audit-findings, User Story 2 — `AuditEngagementFindingController`
 * adds the engagement's own producer of findings and their listing
 * (`createFindingFromEngagement`/`listAuditEngagementFindings`, operations
 * 12-13). `CreateFindingFromEngagementUseCase` DELEGATES to
 * `grc/finding`'s own `CreateFindingUseCase` (imported via `FindingModule`
 * below) rather than duplicating Finding's creation rules — see that use
 * case's own header for the full reasoning.
 *
 * ## No import of `modules/risk`/`modules/controls`/`modules/compliance`
 *
 * Every cross-module dependency (`ControlDirectoryPort`,
 * `FrameworkVersionDirectoryPort`, `RequirementDirectoryPort`) is a
 * `shared/grc-ports/` abstract class, already bound globally by
 * `ControlDirectoryModule`/`ComplianceDirectoryModule` (their owning
 * modules' own composition roots) — this module depends on the PORT
 * token, never on the module that provides it (FR-017, SC-008,
 * `test/unit/audit-engagements-module-boundary.spec.ts`, T021).
 * `FindingModule` (`grc/finding`) is a DIFFERENT, explicitly permitted
 * direction — ADR-016's "business modules may depend on the GRC kernel",
 * never restricted by T021's boundary test (which only ever named
 * Risk/Controls/Compliance).
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { FindingModule } from '../../grc/finding/finding.module';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';

import { AuditEngagementAccessResolver } from './application/audit-engagement-access-resolver.service';
import { CancelAuditEngagementUseCase } from './application/cancel-audit-engagement.usecase';
import { CompleteAuditEngagementUseCase } from './application/complete-audit-engagement.usecase';
import { CreateAuditEngagementUseCase } from './application/create-audit-engagement.usecase';
import { CreateFindingFromEngagementUseCase } from './application/create-finding-from-engagement.usecase';
import { GetAuditEngagementUseCase } from './application/get-audit-engagement.usecase';
import { ListAuditEngagementFindingsUseCase } from './application/list-audit-engagement-findings.usecase';
import { ListAuditEngagementUseCase } from './application/list-audit-engagement.usecase';
import { LinkAuditScopeToControlUseCase } from './application/scope/link-control.usecase';
import { LinkAuditScopeToFrameworkVersionUseCase } from './application/scope/link-framework-version.usecase';
import { LinkAuditScopeToRequirementUseCase } from './application/scope/link-requirement.usecase';
import { ListAuditScopeUseCase } from './application/scope/list-audit-scope.usecase';
import { StartAuditEngagementUseCase } from './application/start-audit-engagement.usecase';
import { UpdateAuditEngagementUseCase } from './application/update-audit-engagement.usecase';
import { AuditEngagementMetricsModule } from './audit-engagement-metrics.module';
import { AuditEngagementReferenceDataPort } from './domain/ports/audit-engagement-reference-data.port';
import { AuditEngagementRepositoryPort } from './domain/ports/audit-engagement-repository.port';
import { AuditScopeRepositoryPort } from './domain/ports/audit-scope-repository.port';
import { PrismaAuditEngagementReferenceDataRepository } from './infrastructure/prisma-audit-engagement-reference-data.repository';
import { PrismaAuditEngagementRepository } from './infrastructure/prisma-audit-engagement.repository';
import { PrismaAuditScopeRepository } from './infrastructure/prisma-audit-scope.repository';
import { AuditEngagementFindingController } from './presentation/audit-engagement-finding.controller';
import { AuditEngagementLifecycleController } from './presentation/audit-engagement-lifecycle.controller';
import { AuditEngagementScopeController } from './presentation/audit-engagement-scope.controller';
import { AuditEngagementController } from './presentation/audit-engagement.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    FindingModule,
    // 009-indicators-reports, T022 — `AuditEngagementMetricsModule` binds
    // `AuditEngagementMetricsPort` to a fresh
    // `PrismaAuditEngagementRepository`, letting `modules/indicators`'s
    // Audit provider reuse the SAME catalog query
    // `GET /audit-engagements` already runs. `IndicatorsModule` imports
    // `AuditEngagementMetricsModule` directly rather than
    // `AuditEngagementsModule` itself (see
    // `audit-engagement-metrics.module.ts`'s own header for why it is no
    // longer `@Global()`).
    AuditEngagementMetricsModule,
  ],
  controllers: [
    AuditEngagementController,
    AuditEngagementScopeController,
    AuditEngagementLifecycleController,
    AuditEngagementFindingController,
  ],
  providers: [
    CreateAuditEngagementUseCase,
    GetAuditEngagementUseCase,
    ListAuditEngagementUseCase,
    UpdateAuditEngagementUseCase,
    StartAuditEngagementUseCase,
    CompleteAuditEngagementUseCase,
    CancelAuditEngagementUseCase,
    LinkAuditScopeToFrameworkVersionUseCase,
    LinkAuditScopeToRequirementUseCase,
    LinkAuditScopeToControlUseCase,
    ListAuditScopeUseCase,
    CreateFindingFromEngagementUseCase,
    ListAuditEngagementFindingsUseCase,
    AuditEngagementAccessResolver,
    { provide: AuditEngagementRepositoryPort, useClass: PrismaAuditEngagementRepository },
    { provide: AuditScopeRepositoryPort, useClass: PrismaAuditScopeRepository },
    {
      provide: AuditEngagementReferenceDataPort,
      useClass: PrismaAuditEngagementReferenceDataRepository,
    },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class AuditEngagementsModule {}
