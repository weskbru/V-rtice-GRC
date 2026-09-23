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
    ControlEffectivenessModule,
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
