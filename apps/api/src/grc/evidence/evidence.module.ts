import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { registerAttachableEntityType } from '../../core/comments/domain/entity-registry';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { registerGrcAuditAllowlists } from '../shared/domain/grc-audit-allowlist';
import { EntityCodeGeneratorPort } from '../shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../shared/infrastructure/prisma-transaction-runner';

import { ArchiveEvidenceUseCase } from './application/archive-evidence.usecase';
import { EvidenceParentRecordAccessor } from './application/collaboration/evidence-parent-record-accessor';
import { CreateEvidenceUseCase } from './application/create-evidence.usecase';
import { EvidenceLinkVisibilityService } from './application/evidence-link-visibility.service';
import { GetEvidenceUseCase } from './application/get-evidence.usecase';
import { LinkEvidenceUseCase } from './application/link-evidence.usecase';
import { ListEvidenceLinksUseCase } from './application/list-evidence-links.usecase';
import { ListEvidenceUseCase } from './application/list-evidence.usecase';
import { UnlinkEvidenceUseCase } from './application/unlink-evidence.usecase';
import { UpdateEvidenceUseCase } from './application/update-evidence.usecase';
import { EvidenceLinkRepositoryPort } from './domain/ports/evidence-link-repository.port';
import { EvidenceReferenceDataPort } from './domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from './domain/ports/evidence-repository.port';
import { PrismaEvidenceLinkRepository } from './infrastructure/prisma-evidence-link.repository';
import { PrismaEvidenceReferenceDataRepository } from './infrastructure/prisma-evidence-reference-data.repository';
import { PrismaEvidenceRepository } from './infrastructure/prisma-evidence.repository';
import { EvidenceController } from './presentation/evidence.controller';

let evidenceCollaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule],
  controllers: [EvidenceController],
  providers: [
    CreateEvidenceUseCase,
    ListEvidenceUseCase,
    GetEvidenceUseCase,
    UpdateEvidenceUseCase,
    ArchiveEvidenceUseCase,
    ListEvidenceLinksUseCase,
    LinkEvidenceUseCase,
    UnlinkEvidenceUseCase,
    EvidenceLinkVisibilityService,
    EvidenceParentRecordAccessor,
    { provide: EvidenceRepositoryPort, useClass: PrismaEvidenceRepository },
    { provide: EvidenceLinkRepositoryPort, useClass: PrismaEvidenceLinkRepository },
    { provide: EvidenceReferenceDataPort, useClass: PrismaEvidenceReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
  exports: [EvidenceLinkRepositoryPort],
})
export class EvidenceModule {
  constructor(evidenceParentRecordAccessor: EvidenceParentRecordAccessor) {
    registerGrcAuditAllowlists();

    if (!evidenceCollaborationRegistered) {
      evidenceCollaborationRegistered = true;
      registerAttachableEntityType('EVIDENCE', evidenceParentRecordAccessor);
    }
  }
}
