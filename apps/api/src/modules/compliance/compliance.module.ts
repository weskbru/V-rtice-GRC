/**
 * T011/T043/T056/004-compliance-management — `ComplianceModule`, this
 * module's own composition root. Sits directly under
 * `src/modules/compliance/`, outside the `domain`/`application`/
 * `infrastructure`/`presentation` folders the boundary lint rules
 * classify — exactly like `controls.module.ts`/`risk.module.ts`, and for
 * the same reason: this is the one place allowed to bind a domain port to
 * its infrastructure implementation (ADR-011).
 *
 * ## What this module owns
 *
 * The normative library (Fase 3, User Story 1, operations 1-9/11/13), the
 * requirement-control mapping and its migration (Fase 4, User Story 2,
 * operations 14-16/21-23), and applicability/compliance state (Fase 5,
 * User Story 3, operations 10/12/17-20) — the whole 23-operation contract.
 *
 * `OrganizationsModule` is imported here (not `@Global()`, unlike
 * `ControlDirectoryModule`/`ControlEffectivenessModule` below) because
 * `LinkRequirementToControlUseCase` is this module's own FIRST consumer of
 * `ScopeResolverService` — ADR-020 part 4, finally exercised: the control
 * referenced by a new `RequirementControlLink` must lie inside the actor's
 * scope before the write, exactly as `modules/risk`'s own
 * `LinkControlUseCase` already established for the identical port.
 *
 * `ControlDirectoryModule`/`ControlEffectivenessModule` (both `@Global()`)
 * are NOT imported here even though `RequirementComplianceReaderService`/
 * `LinkRequirementToControlUseCase` depend on both ports — they are
 * registered globally by `ControlsModule`'s own composition root
 * (`controls.module.ts`), and `AppModule` imports `ControlsModule` before
 * `ComplianceModule` (see `app.module.ts`), so both bindings are already
 * live in the same application-wide injector by the time this module's
 * providers resolve.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';

import { DeclareRequirementNotApplicableUseCase } from './application/applicability/declare-requirement-not-applicable.usecase';
import { ListRequirementApplicabilityDeclarationsUseCase } from './application/applicability/list-requirement-applicability-declarations.usecase';
import { RevokeRequirementApplicabilityUseCase } from './application/applicability/revoke-requirement-applicability.usecase';
import { GetFrameworkVersionComplianceSummaryUseCase } from './application/compliance-summary/get-framework-version-compliance-summary.usecase';
import { CreateFrameworkVersionUseCase } from './application/framework-versions/create-framework-version.usecase';
import { GetFrameworkVersionUseCase } from './application/framework-versions/get-framework-version.usecase';
import { ListFrameworkVersionsUseCase } from './application/framework-versions/list-framework-versions.usecase';
import { PublishFrameworkVersionUseCase } from './application/framework-versions/publish-framework-version.usecase';
import { UpdateFrameworkVersionUseCase } from './application/framework-versions/update-framework-version.usecase';
import { CreateFrameworkUseCase } from './application/frameworks/create-framework.usecase';
import { GetFrameworkUseCase } from './application/frameworks/get-framework.usecase';
import { ListFrameworksUseCase } from './application/frameworks/list-frameworks.usecase';
import { UpdateFrameworkUseCase } from './application/frameworks/update-framework.usecase';
import {
  LinkRequirementToControlUseCase,
  UnlinkRequirementFromControlUseCase,
} from './application/links/link-requirement-control.usecase';
import { ListRequirementControlLinksUseCase } from './application/links/list-requirement-control-links.usecase';
import { ExecuteMappingMigrationUseCase } from './application/mapping-migrations/execute-mapping-migration.usecase';
import { GetMappingMigrationUseCase } from './application/mapping-migrations/get-mapping-migration.usecase';
import { ListMappingMigrationsUseCase } from './application/mapping-migrations/list-mapping-migrations.usecase';
import { RequirementComplianceReaderService } from './application/requirement-compliance-reader.service';
import { CreateRequirementUseCase } from './application/requirements/create-requirement.usecase';
import { GetRequirementUseCase } from './application/requirements/get-requirement.usecase';
import { ListRequirementsUseCase } from './application/requirements/list-requirements.usecase';
import { UpdateRequirementUseCase } from './application/requirements/update-requirement.usecase';
import { ComplianceDirectoryModule } from './compliance-directory.module';
import { ComplianceSummaryModule } from './compliance-summary.module';
import { ComplianceReferenceDataPort } from './domain/ports/compliance-reference-data.port';
import { FrameworkRepositoryPort } from './domain/ports/framework-repository.port';
import { FrameworkVersionRepositoryPort } from './domain/ports/framework-version-repository.port';
import { RequirementApplicabilityRepositoryPort } from './domain/ports/requirement-applicability-repository.port';
import { RequirementComplianceAuditMarkRepositoryPort } from './domain/ports/requirement-compliance-audit-mark-repository.port';
import { RequirementControlLinkRepositoryPort } from './domain/ports/requirement-control-link-repository.port';
import { RequirementControlMappingMigrationRepositoryPort } from './domain/ports/requirement-control-mapping-migration-repository.port';
import { RequirementRepositoryPort } from './domain/ports/requirement-repository.port';
import { FrameworkVersionRepository } from './infrastructure/framework-version.repository';
import { FrameworkRepository } from './infrastructure/framework.repository';
import { PrismaComplianceReferenceDataRepository } from './infrastructure/prisma-compliance-reference-data.repository';
import { RequirementApplicabilityRepository } from './infrastructure/requirement-applicability.repository';
import { RequirementComplianceAuditMarkRepository } from './infrastructure/requirement-compliance-audit-mark.repository';
import { RequirementControlLinkRepository } from './infrastructure/requirement-control-link.repository';
import { RequirementControlMappingMigrationRepository } from './infrastructure/requirement-control-mapping-migration.repository';
import { RequirementRepository } from './infrastructure/requirement.repository';
import { ComplianceSummaryController } from './presentation/compliance-summary.controller';
import { FrameworkVersionController } from './presentation/framework-version.controller';
import { FrameworkController } from './presentation/framework.controller';
import { MappingMigrationController } from './presentation/mapping-migration.controller';
import { RequirementApplicabilityController } from './presentation/requirement-applicability.controller';
import { RequirementControlLinkController } from './presentation/requirement-control-link.controller';
import { RequirementController } from './presentation/requirement.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    OrganizationsModule,
    // 005-audit-findings, T016 — `ComplianceDirectoryModule` (`@Global()`)
    // binds `FrameworkVersionDirectoryPort`/`RequirementDirectoryPort` to
    // this module's own adapters, the mirror of `ControlsModule` importing
    // `ControlDirectoryModule`: lets `modules/audit-engagements`'s scope
    // use cases inject both ports without either module importing the
    // other (ADR-020 part 3, research.md D-11).
    ComplianceDirectoryModule,
    // 009-indicators-reports, T021 — `ComplianceSummaryModule` binds
    // `ComplianceSummaryPort` to a self-contained adapter, letting
    // `modules/indicators`'s Compliance provider compute
    // `COMPLIANCE_PERCENTAGE`. `IndicatorsModule` imports
    // `ComplianceSummaryModule` directly rather than `ComplianceModule`
    // itself (see `compliance-summary.module.ts`'s own header for why it
    // is no longer `@Global()`).
    ComplianceSummaryModule,
  ],
  controllers: [
    FrameworkController,
    FrameworkVersionController,
    RequirementController,
    RequirementControlLinkController,
    RequirementApplicabilityController,
    MappingMigrationController,
    ComplianceSummaryController,
  ],
  providers: [
    CreateFrameworkUseCase,
    GetFrameworkUseCase,
    ListFrameworksUseCase,
    UpdateFrameworkUseCase,
    CreateFrameworkVersionUseCase,
    GetFrameworkVersionUseCase,
    ListFrameworkVersionsUseCase,
    UpdateFrameworkVersionUseCase,
    PublishFrameworkVersionUseCase,
    CreateRequirementUseCase,
    GetRequirementUseCase,
    ListRequirementsUseCase,
    UpdateRequirementUseCase,
    LinkRequirementToControlUseCase,
    UnlinkRequirementFromControlUseCase,
    ListRequirementControlLinksUseCase,
    DeclareRequirementNotApplicableUseCase,
    RevokeRequirementApplicabilityUseCase,
    ListRequirementApplicabilityDeclarationsUseCase,
    ExecuteMappingMigrationUseCase,
    ListMappingMigrationsUseCase,
    GetMappingMigrationUseCase,
    GetFrameworkVersionComplianceSummaryUseCase,
    RequirementComplianceReaderService,
    { provide: FrameworkRepositoryPort, useClass: FrameworkRepository },
    { provide: FrameworkVersionRepositoryPort, useClass: FrameworkVersionRepository },
    { provide: RequirementRepositoryPort, useClass: RequirementRepository },
    { provide: RequirementControlLinkRepositoryPort, useClass: RequirementControlLinkRepository },
    {
      provide: RequirementControlMappingMigrationRepositoryPort,
      useClass: RequirementControlMappingMigrationRepository,
    },
    {
      provide: RequirementApplicabilityRepositoryPort,
      useClass: RequirementApplicabilityRepository,
    },
    {
      provide: RequirementComplianceAuditMarkRepositoryPort,
      useClass: RequirementComplianceAuditMarkRepository,
    },
    { provide: ComplianceReferenceDataPort, useClass: PrismaComplianceReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class ComplianceModule {}
