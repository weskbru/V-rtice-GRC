/**
 * `OrganizationsModule` — the organizations capability's composition root
 * (T038/T039, ADR-011: "nothing may import `infrastructure` except the
 * module's own composition root"). This file sits directly under
 * `src/core/organizations/`, outside the `domain`/`application`/
 * `infrastructure` folders the boundary lint rules classify, so it is the
 * one place allowed to wire a domain port to its infrastructure
 * implementation.
 *
 * `OrgScopeDenialRecorderPort` (T040a, FR-037's scope-side `DENIED`-audit
 * seam) is bound here to `AuditOrgScopeDenialRecorder` — see that class's
 * file header for the transaction/failure-handling decisions.
 * `OrgScopeEnforcerService` (also T040a) is exported alongside
 * `ScopeResolverService` so a future module's application layer can depend
 * on both: resolve the caller's scope, then assert a specific candidate
 * record is within it.
 *
 * T178/T179 add organizational-unit and scope-grant administration
 * (`OrgUnitAdminService`, `ScopeGrantService`) plus their controllers.
 * `ScopeGrantService` is exported so `core/identity`'s user-creation use
 * case can apply initial scope grants atomically with a new user
 * (cross-capability core-application dependency, unrestricted by ADR-011 —
 * see `apps/api/eslint.config.mjs`'s own comment).
 */
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
  // `OrgScopeRepositoryPort` exported for the first BUSINESS consumer of
  // `expandToDescendants` outside this capability: the risk register's
  // `orgUnitId` filter (T105, FR-025b) needs to expand a REQUESTED unit
  // filter to its descendants, which is a different operation from
  // resolving the caller's own scope (`ScopeResolverService`'s job).
  // `ScopeGrantService` exported for T176 (see file header).
  // `AssignmentLineService` exported because BOTH sides of the assignment
  // rule live outside this capability: `core/identity`'s directory listing
  // reads it, and `modules/risk`'s create/update use cases enforce it. One
  // exported resolver is the whole point — see that service's own header.
  exports: [
    ScopeResolverService,
    OrgScopeEnforcerService,
    OrgScopeRepositoryPort,
    ScopeGrantService,
    AssignmentLineService,
  ],
})
export class OrganizationsModule {}
