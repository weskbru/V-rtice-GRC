import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { registerEvidenceSubjectResolver } from '../../grc/shared/domain/ports/evidence-subject-resolver.port';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';

import { ControlEvidenceSubjectAccessor } from './application/collaboration/control-evidence-subject-accessor';
import { ControlAccessResolver } from './application/control-access-resolver.service';
import {
  LinkControlToAssetUseCase,
  UnlinkControlFromAssetUseCase,
} from './application/links/control-asset-link.usecase';
import {
  LinkControlToProcessUseCase,
  UnlinkControlFromProcessUseCase,
} from './application/links/control-process-link.usecase';
import {
  ListControlAssetLinksUseCase,
  ListControlProcessLinksUseCase,
  ListControlRiskLinksUseCase,
} from './application/links/list-control-links.usecase';
import { registerControlAssessmentAuditAllowlists } from './control-assessment-audit-allowlist';
import { ControlLookupPort } from './domain/ports/control-lookup.port';
import { ControlReferenceDataPort } from './domain/ports/control-reference-data.port';
import {
  ControlAssetLinkRepositoryPort,
  ControlProcessLinkRepositoryPort,
} from './domain/ports/control-relationship-repository.port';
import { ControlAssetLinkRepository } from './infrastructure/control-asset-link.repository';
import { ControlLookupRepository } from './infrastructure/control-lookup.repository';
import { ControlProcessLinkRepository } from './infrastructure/control-process-link.repository';
import { PrismaControlReferenceDataRepository } from './infrastructure/prisma-control-reference-data.repository';
import { ControlRelationshipController } from './presentation/control-relationship.controller';

let collaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule],
  controllers: [ControlRelationshipController],
  providers: [
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
    { provide: ControlLookupPort, useClass: ControlLookupRepository },
    { provide: ControlReferenceDataPort, useClass: PrismaControlReferenceDataRepository },
    { provide: ControlProcessLinkRepositoryPort, useClass: ControlProcessLinkRepository },
    { provide: ControlAssetLinkRepositoryPort, useClass: ControlAssetLinkRepository },
    ControlAccessResolver,
    LinkControlToProcessUseCase,
    UnlinkControlFromProcessUseCase,
    LinkControlToAssetUseCase,
    UnlinkControlFromAssetUseCase,
    ListControlProcessLinksUseCase,
    ListControlAssetLinksUseCase,
    ListControlRiskLinksUseCase,
    ControlEvidenceSubjectAccessor,
  ],
})
export class ControlRelationshipModule {
  constructor(private readonly evidenceSubjectAccessor: ControlEvidenceSubjectAccessor) {
    registerControlAssessmentAuditAllowlists();

    if (!collaborationRegistered) {
      collaborationRegistered = true;
      registerEvidenceSubjectResolver('CONTROL', this.evidenceSubjectAccessor);
    }
  }
}
