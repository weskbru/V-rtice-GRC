/**
 * T009,T017-T022/006-assets-processes — `AssetsModule`, this module's own
 * composition root. Sits directly under `src/modules/assets/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify — exactly like `controls.module.ts`, and for
 * the same reason: this is the one place allowed to bind a domain port to
 * its infrastructure implementation (ADR-011).
 *
 * ## Fase 3 (User Story 1) — controllers/use cases/repository bindings
 *
 * `AssetController` and its six use cases join this module now, the same
 * shape `ControlsModule`/`FindingModule` already establish. `PrismaModule`
 * was already imported (T009); `AuditModule`/`OrganizationsModule`/
 * `AuthorizationModule` join here because the six use cases need
 * `AuditRecorder`/`ScopeResolverService`/`OrgScopeEnforcerService`/
 * `PermissionGuard`'s own metadata resolution (the same three imports
 * `ControlsModule`/`FindingModule` carry).
 *
 * `EntityCodeGeneratorPort`/`TransactionRunnerPort` are declared by the GRC
 * kernel (`grc/shared`) and bound to its Prisma implementations here rather
 * than reimplemented — see `ControlsModule`'s own header for why this reuse
 * is the correct call, not a coupling shortcut. Assets contributes the
 * `AST` prefix to the kernel's closed registry (data-model.md §2); it does
 * not contribute a second allocator.
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
import { IncidentAssetLinkReadModule } from '../incidents/incident-asset-link-read.module';

import { CreateAssetUseCase } from './application/create-asset.usecase';
import { DeactivateAssetUseCase } from './application/deactivate-asset.usecase';
import { GetAssetUseCase } from './application/get-asset.usecase';
import { ListAssetIncidentLinksUseCase } from './application/list-asset-incident-links.usecase';
import { ListAssetsUseCase } from './application/list-assets.usecase';
import { ReactivateAssetUseCase } from './application/reactivate-asset.usecase';
import { UpdateAssetUseCase } from './application/update-asset.usecase';
import { AssetDirectoryModule } from './asset-directory.module';
import { AssetMetricsModule } from './asset-metrics.module';
import { registerAssetAuditAllowlists } from './domain/asset-audit-allowlist';
import { AssetReferenceDataPort } from './domain/ports/asset-reference-data.port';
import { AssetRepositoryPort } from './domain/ports/asset-repository.port';
import { PrismaAssetReferenceDataRepository } from './infrastructure/prisma-asset-reference-data.repository';
import { PrismaAssetRepository } from './infrastructure/prisma-asset.repository';
import { AssetController } from './presentation/asset.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    AssetDirectoryModule,
    // 009-indicators-reports, T024 — `AssetMetricsModule` binds
    // `AssetMetricsPort` to a fresh `PrismaAssetRepository`, letting
    // `modules/indicators`'s Asset provider reuse the SAME catalog query
    // `GET /assets` already runs. `IndicatorsModule` imports
    // `AssetMetricsModule` directly rather than `AssetsModule` itself (see
    // `asset-metrics.module.ts`'s own header for why it is no longer
    // `@Global()`).
    AssetMetricsModule,
    // 013-incidents-problems-reverse-links — `IncidentAssetLinkReadModule`
    // binds `IncidentAssetLinkReadPort` to `modules/incidents`' own
    // adapter. This module imports it directly so
    // `ListAssetIncidentLinksUseCase` (below) can inject that port without
    // either module importing the other (CLAUDE.md §19.10 — a partial
    // Nest test graph must not depend on global provider visibility).
    IncidentAssetLinkReadModule,
  ],
  controllers: [AssetController],
  providers: [
    CreateAssetUseCase,
    GetAssetUseCase,
    UpdateAssetUseCase,
    ListAssetsUseCase,
    DeactivateAssetUseCase,
    ReactivateAssetUseCase,
    // 013-incidents-problems-reverse-links — read-only reverse of
    // `IncidentAssetLink`, owned by `modules/incidents`; injected via
    // `IncidentAssetLinkReadModule`, imported directly above.
    ListAssetIncidentLinksUseCase,
    { provide: AssetRepositoryPort, useClass: PrismaAssetRepository },
    { provide: AssetReferenceDataPort, useClass: PrismaAssetReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class AssetsModule {
  constructor() {
    // T014/006-assets-processes: register this module's own
    // `AuditEntityType.ASSET` field allow-list from its own file, without
    // editing `core/audit/**` (ADR-011) — the exact extension point
    // `core-entity-audit-allowlists.ts` describes, mirroring `RiskModule`'s
    // own `registerRiskAuditAllowlists()` call.
    registerAssetAuditAllowlists();
  }
}
