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
