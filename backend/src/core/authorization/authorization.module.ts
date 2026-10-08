import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AuditModule } from '../audit/audit.module';

import { GetRolesSummaryUseCase } from './application/get-roles-summary.usecase';
import { PermissionResolverService } from './application/permission-resolver.service';
import { RoleAdminService } from './application/role-admin.service';
import { ActorDirectoryPort } from './domain/ports/actor-directory.port';
import { CurrentActorPort } from './domain/ports/current-actor.port';
import { PermissionCachePort } from './domain/ports/permission-cache.port';
import { PermissionDenialRecorderPort } from './domain/ports/permission-denial-recorder.port';
import { PermissionRepositoryPort } from './domain/ports/permission-repository.port';
import { RoleRepositoryPort } from './domain/ports/role-repository.port';
import { AuditPermissionDenialRecorder } from './infrastructure/audit-permission-denial-recorder';
import { CacheProviderPermissionCacheAdapter } from './infrastructure/cache-provider-permission-cache.adapter';
import { PrismaActorDirectory } from './infrastructure/prisma-actor-directory';
import { PrismaPermissionRepository } from './infrastructure/prisma-permission.repository';
import { PrismaRoleRepository } from './infrastructure/prisma-role.repository';
import { PrismaTransactionRunner } from './infrastructure/prisma-transaction-runner';
import { RequestContextCurrentActorProvider } from './infrastructure/request-context-current-actor.provider';
import { AdminPermissionsController } from './presentation/admin-permissions.controller';
import { AdminRolesController } from './presentation/admin-roles.controller';
import { PermissionGuard } from './presentation/permission.guard';

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [AdminRolesController, AdminPermissionsController],
  providers: [
    PermissionResolverService,
    RoleAdminService,
    GetRolesSummaryUseCase,
    PermissionGuard,
    { provide: PermissionRepositoryPort, useClass: PrismaPermissionRepository },
    { provide: RoleRepositoryPort, useClass: PrismaRoleRepository },
    { provide: ActorDirectoryPort, useClass: PrismaActorDirectory },
    { provide: PermissionCachePort, useClass: CacheProviderPermissionCacheAdapter },
    { provide: CurrentActorPort, useClass: RequestContextCurrentActorProvider },
    { provide: PermissionDenialRecorderPort, useClass: AuditPermissionDenialRecorder },
    { provide: TransactionRunnerPort, useClass: PrismaTransactionRunner },
  ],
  exports: [PermissionResolverService, PermissionGuard, RoleAdminService],
})
export class AuthorizationModule {}
