/**
 * T024/003-controls-management — a TEST-ONLY Nest module standing in for
 * the real `ControlsModule` (`src/modules/controls/controls.module.ts`)
 * while that file's own wiring is still owned by the coordinator (this
 * task's own working rules: "Do NOT edit
 * apps/api/src/modules/controls/controls.module.ts").
 *
 * This module registers EXACTLY the controllers/use-cases/repository
 * bindings User Story 1 (operations 1-6 of
 * `contracts/controls.openapi.yaml`) needs — see this task's own report
 * for the exact list the coordinator must fold into the real
 * `ControlsModule` alongside the other Controls Management workstream's
 * own providers (assessments, attestation, process/asset links, operations
 * 7-18).
 *
 * Used via `.overrideModule(ControlsModule).useModule(ControlsTestModule)`
 * against the REAL `AppModule` (`controls-contract-app.ts`) — every other
 * guard/filter/pipe/middleware `main.ts` wires stays exactly as it is; only
 * the Controls module's own composition is swapped in for one that
 * actually has User Story 1's routes, so the contract suite exercises the
 * real HTTP surface (permission guard, session guard, validation pipe,
 * problem-details filter) end to end rather than a hand-rolled bypass.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../../src/core/audit/audit.module';
import { AuthorizationModule } from '../../../src/core/authorization/authorization.module';
import { OrganizationsModule } from '../../../src/core/organizations/organizations.module';
import { EntityCodeGeneratorPort } from '../../../src/grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../../src/grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../../src/grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../../src/infrastructure/prisma/prisma.module';
import { CreateControlUseCase } from '../../../src/modules/controls/application/create-control.usecase';
import { GetControlUseCase } from '../../../src/modules/controls/application/get-control.usecase';
import { GetControlLifecycleUseCase } from '../../../src/modules/controls/application/lifecycle/get-control-lifecycle.usecase';
import { ListControlsUseCase } from '../../../src/modules/controls/application/list-controls.usecase';
import { PerformControlTransitionUseCase } from '../../../src/modules/controls/application/perform-control-transition.usecase';
import { UpdateControlUseCase } from '../../../src/modules/controls/application/update-control.usecase';
import { ControlDirectoryModule } from '../../../src/modules/controls/control-directory.module';
import { ControlEffectivenessModule } from '../../../src/modules/controls/control-effectiveness.module';
import { registerControlAuditAllowlists } from '../../../src/modules/controls/domain/control-audit-allowlist';
import { ControlLifecycleTransitionRepositoryPort } from '../../../src/modules/controls/domain/ports/control-lifecycle-transition-repository.port';
import { ControlQueryPort } from '../../../src/modules/controls/domain/ports/control-query.port';
import { ControlReferenceDataPort } from '../../../src/modules/controls/domain/ports/control-reference-data.port';
import { ControlRepositoryPort } from '../../../src/modules/controls/domain/ports/control-repository.port';
import { ControlLifecycleTransitionRepository } from '../../../src/modules/controls/infrastructure/control-lifecycle-transition.repository';
import { ControlQueryService } from '../../../src/modules/controls/infrastructure/control-query.service';
import { ControlRepository } from '../../../src/modules/controls/infrastructure/control.repository';
import { PrismaControlReferenceDataRepository } from '../../../src/modules/controls/infrastructure/prisma-control-reference-data.repository';
import { ControlLifecycleController } from '../../../src/modules/controls/presentation/control-lifecycle.controller';
import { ControlController } from '../../../src/modules/controls/presentation/control.controller';
import { TransactionRunnerPort } from '../../../src/shared/persistence/transaction-runner.port';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ControlDirectoryModule,
    // 004-compliance-management, T015 — overriding the real `ControlsModule`
    // with this test-only module (this file's own header) also removes
    // its `ControlEffectivenessModule` import; the real `AppModule` now
    // includes `ComplianceModule`, whose `RequirementComplianceReaderService`
    // needs `ControlEffectivenessPort` resolvable at bootstrap regardless
    // of which Controls composition root is active.
    ControlEffectivenessModule,
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
})
export class ControlsTestModule {
  constructor() {
    registerControlAuditAllowlists();
  }
}
