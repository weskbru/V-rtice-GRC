/**
 * T009/003-controls-management — `ControlsModule`, the Controls Management
 * module's own composition root. Sits directly under
 * `src/modules/controls/`, outside the `domain`/`application`/
 * `infrastructure`/`presentation` folders the boundary lint rules classify —
 * exactly like `risk.module.ts`, and for the same reason: this is the one
 * place allowed to bind a domain port to its infrastructure implementation
 * (ADR-011).
 *
 * ## What this module owns, and what it deliberately does not
 *
 * It owns the control **catalogue and lifecycle** (contract operations 1-6).
 * Assessments/attestation (7-11) and relationships (12-18) live in
 * `ControlAssessmentModule` and `ControlRelationshipModule`, which are
 * separate composition roots imported by `AppModule` alongside this one.
 * That split is not cosmetic: those two surfaces have their own repositories,
 * their own audit entity types and their own approval wiring, and keeping
 * them separate means a change to attestation cannot silently re-wire the
 * catalogue.
 *
 * `ControlDirectoryModule` (the ADR-020 boundary port, `@Global()`, T010)
 * stays a SEPARATE module — see its own header — but is imported here so a
 * catalogue use case can depend on the same token without `AppModule`
 * importing it twice for that purpose.
 *
 * ## The two shared-kernel bindings below, and why they are here
 *
 * `EntityCodeGeneratorPort` and `TransactionRunnerPort` are declared by the
 * GRC kernel (`grc/shared`) and bound to its Prisma implementations here
 * rather than reimplemented. `modules/** -> grc/**` is a permitted direction,
 * and the alternative — a Controls-owned copy of the `UPSERT ... ON CONFLICT`
 * sequence allocator, or a second transaction runner — is exactly the
 * "one mechanism in two places" defect class this project has already
 * recorded (F-42). Controls contributes the `CTL` prefix to the kernel's
 * closed registry (data-model.md §1); it does not contribute a second
 * allocator.
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

import { CreateControlUseCase } from './application/create-control.usecase';
import { GetControlUseCase } from './application/get-control.usecase';
import { GetControlLifecycleUseCase } from './application/lifecycle/get-control-lifecycle.usecase';
import { ListControlsUseCase } from './application/list-controls.usecase';
import { PerformControlTransitionUseCase } from './application/perform-control-transition.usecase';
import { UpdateControlUseCase } from './application/update-control.usecase';
import { ControlDirectoryModule } from './control-directory.module';
import { ControlEffectivenessModule } from './control-effectiveness.module';
import { ControlMetricsModule } from './control-metrics.module';
import { ControlLifecycleTransitionRepositoryPort } from './domain/ports/control-lifecycle-transition-repository.port';
import { ControlQueryPort } from './domain/ports/control-query.port';
import { ControlReferenceDataPort } from './domain/ports/control-reference-data.port';
import { ControlRepositoryPort } from './domain/ports/control-repository.port';
import { ControlLifecycleTransitionRepository } from './infrastructure/control-lifecycle-transition.repository';
import { ControlQueryService } from './infrastructure/control-query.service';
import { ControlRepository } from './infrastructure/control.repository';
import { PrismaControlReferenceDataRepository } from './infrastructure/prisma-control-reference-data.repository';
import { ControlLifecycleController } from './presentation/control-lifecycle.controller';
import { ControlController } from './presentation/control.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ControlDirectoryModule,
    // 004-compliance-management, T015 — the second ADR-020 boundary port
    // (research.md D-9), wired here for the same reason
    // `ControlDirectoryModule` already is: this is Controls' own
    // composition root, the one legitimate place to bind Controls' own
    // port implementation.
    ControlEffectivenessModule,
    // 009-indicators-reports, T020 — `ControlMetricsModule` binds
    // `ControlMetricsPort` to a fresh `ControlQueryService`, letting
    // `modules/indicators`'s Control provider reuse the SAME catalog query
    // `GET /controls` already runs. `IndicatorsModule` imports
    // `ControlMetricsModule` directly rather than `ControlsModule` itself
    // (see `control-metrics.module.ts`'s own header for why it is no
    // longer `@Global()`).
    ControlMetricsModule,
  ],
  controllers: [ControlController, ControlLifecycleController],
  providers: [
    CreateControlUseCase,
    GetControlUseCase,
    UpdateControlUseCase,
    ListControlsUseCase,
    GetControlLifecycleUseCase,
    PerformControlTransitionUseCase,
    { provide: ControlRepositoryPort, useClass: ControlRepository },
    { provide: ControlReferenceDataPort, useClass: PrismaControlReferenceDataRepository },
    { provide: ControlQueryPort, useClass: ControlQueryService },
    {
      provide: ControlLifecycleTransitionRepositoryPort,
      useClass: ControlLifecycleTransitionRepository,
    },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
  exports: [ControlReferenceDataPort],
})
export class ControlsModule {}
