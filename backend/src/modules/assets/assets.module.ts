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
    AssetMetricsModule,
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
    ListAssetIncidentLinksUseCase,
    { provide: AssetRepositoryPort, useClass: PrismaAssetRepository },
    { provide: AssetReferenceDataPort, useClass: PrismaAssetReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class AssetsModule {
  constructor() {
    registerAssetAuditAllowlists();
  }
}
