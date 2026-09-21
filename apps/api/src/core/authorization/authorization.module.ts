/**
 * `AuthorizationModule` — the authorization capability's composition root
 * (T034-T036, ADR-011: "nothing may import `infrastructure` except the
 * module's own composition root"). This file sits directly under
 * `src/core/authorization/`, outside the `domain`/`application`/
 * `infrastructure`/`presentation` folders the boundary lint rules
 * classify, so it is the one place allowed to wire a domain port to its
 * infrastructure implementation and to assemble the guard.
 *
 * `PermissionDenialRecorderPort` (FR-037's `DENIED`-audit seam) is now
 * bound here (T040a) to `AuditPermissionDenialRecorder` — see that class's
 * file header for why it lives in `core/authorization/infrastructure`
 * rather than `core/audit/**`, and for the transaction/failure-handling
 * decisions. Importing `AuditModule` here is legal under the ADR-011
 * boundary rules: this is a module composition root, not a `core-*`
 * layer file, so it is unaffected by the `eslint-plugin-boundaries`
 * classification entirely (only files under `domain/application/
 * infrastructure/presentation` are classified).
 *
 * Not imported by `AppModule` in this task — see permission.guard.ts's
 * file header for why registering `PermissionGuard` globally is left to
 * whichever task introduces the authentication guard that populates
 * `RequestContext.actorUserId`.
 */
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
    // 2026-09-13 (015-roles-permissions-surface, T011): read-only, consumed
    // only by `AdminRolesController` — deliberately NOT exported, unlike
    // `RoleAdminService`, because no other capability needs it.
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
  // `RoleAdminService` exported (T177) so `core/identity`'s admin-users
  // use cases can assign roles atomically with user creation and serve
  // `PUT /admin/users/{userId}/roles` — cross-capability core-application
  // dependency, unrestricted by the ADR-011 boundary rules (see
  // `apps/api/eslint.config.mjs`'s own comment: "Cross-capability core
  // imports are not restricted here").
  exports: [PermissionResolverService, PermissionGuard, RoleAdminService],
})
export class AuthorizationModule {}
