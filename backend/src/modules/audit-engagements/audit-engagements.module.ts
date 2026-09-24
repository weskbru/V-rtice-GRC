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
