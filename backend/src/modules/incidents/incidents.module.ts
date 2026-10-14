import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import {
  registerAttachableEntityType,
  registerCommentableEntityType,
} from '../../core/comments/domain/entity-registry';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { registerActionOriginResolver } from '../../grc/shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { registerEvidenceSubjectResolver } from '../../grc/shared/domain/ports/evidence-subject-resolver.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';

import { IncidentParentRecordAccessor } from './application/collaboration/incident-parent-record-accessor';
import { CreateIncidentUseCase } from './application/create-incident.usecase';
import { GetIncidentUseCase } from './application/get-incident.usecase';
import { IncidentActionOriginAccessor } from './application/incident-action-origin-accessor';
import { IncidentEvidenceSubjectAccessor } from './application/incident-evidence-subject-accessor';
import {
  LinkIncidentAssetUseCase,
  ListIncidentAssetLinksUseCase,
  UnlinkIncidentAssetUseCase,
} from './application/links/link-incident-asset.usecase';
import {
  LinkIncidentProcessUseCase,
  ListIncidentProcessLinksUseCase,
  UnlinkIncidentProcessUseCase,
} from './application/links/link-incident-process.usecase';
import {
  LinkIncidentRiskUseCase,
  ListIncidentRiskLinksUseCase,
  UnlinkIncidentRiskUseCase,
} from './application/links/link-incident-risk.usecase';
import { ListIncidentProblemLinksUseCase } from './application/links/list-incident-problem-links.usecase';
import { ListIncidentsUseCase } from './application/list-incidents.usecase';
import { TransitionIncidentUseCase } from './application/transition-incident.usecase';
import { UpdateIncidentUseCase } from './application/update-incident.usecase';
import { registerIncidentAuditAllowlists } from './domain/incident-audit-allowlist';
import { IncidentAssetLinkRepositoryPort } from './domain/ports/incident-asset-link-repository.port';
import { IncidentProblemLinkReadPort } from './domain/ports/incident-problem-link-read.port';
import { IncidentProcessLinkRepositoryPort } from './domain/ports/incident-process-link-repository.port';
import { IncidentReferenceDataPort } from './domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from './domain/ports/incident-repository.port';
import { IncidentRiskLinkRepositoryPort } from './domain/ports/incident-risk-link-repository.port';
import { IncidentAssetLinkReadModule } from './incident-asset-link-read.module';
import { IncidentDirectoryModule } from './incident-directory.module';
import { IncidentMetricsModule } from './incident-metrics.module';
import { IncidentProcessLinkReadModule } from './incident-process-link-read.module';
import { IncidentRiskLinkReadModule } from './incident-risk-link-read.module';
import { PrismaIncidentAssetLinkRepository } from './infrastructure/prisma-incident-asset-link.repository';
import { PrismaIncidentProblemLinkReadRepository } from './infrastructure/prisma-incident-problem-link-read.repository';
import { PrismaIncidentProcessLinkRepository } from './infrastructure/prisma-incident-process-link.repository';
import { PrismaIncidentReferenceDataRepository } from './infrastructure/prisma-incident-reference-data.repository';
import { PrismaIncidentRiskLinkRepository } from './infrastructure/prisma-incident-risk-link.repository';
import { PrismaIncidentRepository } from './infrastructure/prisma-incident.repository';
import { IncidentRelationshipController } from './presentation/incident-relationship.controller';
import { IncidentController } from './presentation/incident.controller';

let collaborationRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    OrganizationsModule,
    IncidentDirectoryModule,
    IncidentRiskLinkReadModule,
    IncidentAssetLinkReadModule,
    IncidentProcessLinkReadModule,
    IncidentMetricsModule,
  ],
  controllers: [IncidentController, IncidentRelationshipController],
  providers: [
    IncidentEvidenceSubjectAccessor,
    IncidentActionOriginAccessor,
    IncidentParentRecordAccessor,
    CreateIncidentUseCase,
    GetIncidentUseCase,
    ListIncidentsUseCase,
    UpdateIncidentUseCase,
    TransitionIncidentUseCase,
    LinkIncidentRiskUseCase,
    UnlinkIncidentRiskUseCase,
    ListIncidentRiskLinksUseCase,
    LinkIncidentAssetUseCase,
    UnlinkIncidentAssetUseCase,
    ListIncidentAssetLinksUseCase,
    LinkIncidentProcessUseCase,
    UnlinkIncidentProcessUseCase,
    ListIncidentProcessLinksUseCase,
    ListIncidentProblemLinksUseCase,
    { provide: IncidentRepositoryPort, useClass: PrismaIncidentRepository },
    { provide: IncidentReferenceDataPort, useClass: PrismaIncidentReferenceDataRepository },
    { provide: IncidentRiskLinkRepositoryPort, useClass: PrismaIncidentRiskLinkRepository },
    { provide: IncidentAssetLinkRepositoryPort, useClass: PrismaIncidentAssetLinkRepository },
    { provide: IncidentProcessLinkRepositoryPort, useClass: PrismaIncidentProcessLinkRepository },
    { provide: IncidentProblemLinkReadPort, useClass: PrismaIncidentProblemLinkReadRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class IncidentsModule {
  constructor(
    private readonly evidenceSubjectAccessor: IncidentEvidenceSubjectAccessor,
    private readonly actionOriginAccessor: IncidentActionOriginAccessor,
    private readonly parentRecordAccessor: IncidentParentRecordAccessor,
  ) {
    registerIncidentAuditAllowlists();

    if (!collaborationRegistered) {
      collaborationRegistered = true;
      registerEvidenceSubjectResolver('INCIDENT', this.evidenceSubjectAccessor);
      registerActionOriginResolver('INCIDENT', this.actionOriginAccessor);

      registerAttachableEntityType('INCIDENT', this.parentRecordAccessor);
      registerCommentableEntityType('INCIDENT', this.parentRecordAccessor);
    }
  }
}
