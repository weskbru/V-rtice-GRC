import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AuditModule } from '../audit/audit.module';

import { AssignmentLineService } from './application/assignment-line.service';
import { ListOrgUnitsUseCase } from './application/list-org-units.usecase';
import { OrgScopeEnforcerService } from './application/org-scope-enforcer.service';
import { OrgUnitAdminService } from './application/org-unit-admin.service';
import { ScopeGrantService } from './application/scope-grant.service';
import { ScopeResolverService } from './application/scope-resolver.service';
import { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import { OrgScopeDenialRecorderPort } from './domain/ports/org-scope-denial-recorder.port';
import { OrgScopeRepositoryPort } from './domain/ports/org-scope-repository.port';
import { OrgUnitAdminRepositoryPort } from './domain/ports/org-unit-admin-repository.port';
import { OrgUnitDirectoryPort } from './domain/ports/org-unit-directory.port';
import { ScopeCachePort } from './domain/ports/scope-cache.port';
import { AuditOrgScopeDenialRecorder } from './infrastructure/audit-org-scope-denial-recorder';
import { CacheProviderScopeCacheAdapter } from './infrastructure/cache-provider-scope-cache.adapter';
import { PrismaActorDirectory } from './infrastructure/prisma-actor-directory';
import { PrismaOrgScopeRepository } from './infrastructure/prisma-org-scope.repository';
import { PrismaOrgUnitAdminRepository } from './infrastructure/prisma-org-unit-admin.repository';
import { PrismaOrgUnitDirectoryRepository } from './infrastructure/prisma-org-unit-directory.repository';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { AdminOrgUnitsController } from './presentation/admin-org-units.controller';
import { AdminUserScopeGrantsController } from './presentation/admin-user-scope-grants.controller';
import { OrgUnitController } from './presentation/org-unit.controller';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [OrgUnitController, AdminOrgUnitsController, AdminUserScopeGrantsController],
  providers: [
    ScopeResolverService,
    OrgScopeEnforcerService,
    AssignmentLineService,
    ListOrgUnitsUseCase,
    OrgUnitAdminService,
    ScopeGrantService,
    { provide: OrgScopeRepositoryPort, useClass: PrismaOrgScopeRepository },
    { provide: ScopeCachePort, useClass: CacheProviderScopeCacheAdapter },
    { provide: OrgScopeDenialRecorderPort, useClass: AuditOrgScopeDenialRecorder },
    { provide: OrgUnitDirectoryPort, useClass: PrismaOrgUnitDirectoryRepository },
    { provide: OrgUnitAdminRepositoryPort, useClass: PrismaOrgUnitAdminRepository },
    { provide: ActorDirectoryPort, useClass: PrismaActorDirectory },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
  ],
  exports: [
    ScopeResolverService,
    OrgScopeEnforcerService,
    OrgScopeRepositoryPort,
    ScopeGrantService,
    AssignmentLineService,
  ],
})
export class OrganizationsModule {}
