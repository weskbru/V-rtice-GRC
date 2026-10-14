import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { IncidentProcessLinkReadModule } from '../incidents/incident-process-link-read.module';

import { CreateProcessUseCase } from './application/create-process.usecase';
import { DeactivateProcessUseCase } from './application/deactivate-process.usecase';
import { GetProcessUseCase } from './application/get-process.usecase';
import { ListProcessIncidentLinksUseCase } from './application/list-process-incident-links.usecase';
import { ListProcessesUseCase } from './application/list-processes.usecase';
import { ReactivateProcessUseCase } from './application/reactivate-process.usecase';
import { UpdateProcessUseCase } from './application/update-process.usecase';
import { ProcessReferenceDataPort } from './domain/ports/process-reference-data.port';
import { ProcessRepositoryPort } from './domain/ports/process-repository.port';
import { registerProcessAuditAllowlists } from './domain/process-audit-allowlist';
import { PrismaProcessReferenceDataRepository } from './infrastructure/prisma-process-reference-data.repository';
import { PrismaProcessRepository } from './infrastructure/prisma-process.repository';
import { ProcessController } from './presentation/process.controller';
import { ProcessDirectoryModule } from './process-directory.module';
import { ProcessMetricsModule } from './process-metrics.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ProcessDirectoryModule,
    ProcessMetricsModule,
    IncidentProcessLinkReadModule,
  ],
  controllers: [ProcessController],
  providers: [
    CreateProcessUseCase,
    GetProcessUseCase,
    UpdateProcessUseCase,
    ListProcessesUseCase,
    DeactivateProcessUseCase,
    ReactivateProcessUseCase,
    ListProcessIncidentLinksUseCase,
    { provide: ProcessRepositoryPort, useClass: PrismaProcessRepository },
    { provide: ProcessReferenceDataPort, useClass: PrismaProcessReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class ProcessesModule {
  constructor() {
    registerProcessAuditAllowlists();
  }
}
