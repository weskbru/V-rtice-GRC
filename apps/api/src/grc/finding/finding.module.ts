import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { EvidenceModule } from '../evidence/evidence.module';
import { registerGrcAuditAllowlists } from '../shared/domain/grc-audit-allowlist';
import { registerActionOriginResolver } from '../shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../shared/domain/ports/entity-code-generator.port';
import { registerEvidenceSubjectResolver } from '../shared/domain/ports/evidence-subject-resolver.port';
import { PrismaEntityCodeGenerator } from '../shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../shared/infrastructure/prisma-transaction-runner';

import { ArchiveFindingUseCase } from './application/archive-finding.usecase';
import { CloseFindingUseCase } from './application/close-finding.usecase';
import { FindingActionOriginAccessor } from './application/collaboration/finding-action-origin-accessor';
import { FindingEvidenceSubjectAccessor } from './application/collaboration/finding-evidence-subject-accessor';
import { CreateFindingUseCase } from './application/create-finding.usecase';
import { GetFindingUseCase } from './application/get-finding.usecase';
import {
  LinkFindingControlUseCase,
  ListFindingControlLinksUseCase,
  UnlinkFindingControlUseCase,
} from './application/links/link-finding-control.usecase';
import {
  LinkFindingRiskUseCase,
  ListFindingRiskLinksUseCase,
  UnlinkFindingRiskUseCase,
} from './application/links/link-finding-risk.usecase';
import { ListFindingUseCase } from './application/list-finding.usecase';
import { ReopenFindingUseCase } from './application/reopen-finding.usecase';
import { StartFindingRemediationUseCase } from './application/start-remediation.usecase';
import { UpdateFindingUseCase } from './application/update-finding.usecase';
import { FindingControlLinkRepositoryPort } from './domain/ports/finding-control-link-repository.port';
import { FindingReferenceDataPort } from './domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from './domain/ports/finding-repository.port';
import { FindingRiskLinkRepositoryPort } from './domain/ports/finding-risk-link-repository.port';
import { PrismaFindingControlLinkRepository } from './infrastructure/prisma-finding-control-link.repository';
import { PrismaFindingReferenceDataRepository } from './infrastructure/prisma-finding-reference-data.repository';
import { PrismaFindingRiskLinkRepository } from './infrastructure/prisma-finding-risk-link.repository';
import { PrismaFindingRepository } from './infrastructure/prisma-finding.repository';
import { FindingRelationshipController } from './presentation/finding-relationship.controller';
import { FindingController } from './presentation/finding.controller';

let findingCollaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule, EvidenceModule],
  controllers: [FindingController, FindingRelationshipController],
  providers: [
    CreateFindingUseCase,
    ListFindingUseCase,
    GetFindingUseCase,
    UpdateFindingUseCase,
    CloseFindingUseCase,
    ReopenFindingUseCase,
    ArchiveFindingUseCase,
    StartFindingRemediationUseCase,
    LinkFindingControlUseCase,
    UnlinkFindingControlUseCase,
    ListFindingControlLinksUseCase,
    LinkFindingRiskUseCase,
    UnlinkFindingRiskUseCase,
    ListFindingRiskLinksUseCase,
    FindingEvidenceSubjectAccessor,
    FindingActionOriginAccessor,
    { provide: FindingRepositoryPort, useClass: PrismaFindingRepository },
    { provide: FindingReferenceDataPort, useClass: PrismaFindingReferenceDataRepository },
    { provide: FindingControlLinkRepositoryPort, useClass: PrismaFindingControlLinkRepository },
    { provide: FindingRiskLinkRepositoryPort, useClass: PrismaFindingRiskLinkRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
  exports: [CreateFindingUseCase, FindingRepositoryPort],
})
export class FindingModule {
  constructor(
    findingEvidenceSubjectAccessor: FindingEvidenceSubjectAccessor,
    findingActionOriginAccessor: FindingActionOriginAccessor,
  ) {
    registerGrcAuditAllowlists();

    if (!findingCollaborationRegistered) {
      findingCollaborationRegistered = true;
      registerEvidenceSubjectResolver('FINDING', findingEvidenceSubjectAccessor);
      registerActionOriginResolver('FINDING', findingActionOriginAccessor);
    }
  }
}
