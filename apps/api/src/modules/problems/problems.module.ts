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
import { IncidentDirectoryModule } from '../incidents/incident-directory.module';

import { ProblemParentRecordAccessor } from './application/collaboration/problem-parent-record-accessor';
import { CreateProblemUseCase } from './application/create-problem.usecase';
import { GetProblemUseCase } from './application/get-problem.usecase';
import {
  LinkProblemIncidentUseCase,
  ListProblemIncidentLinksUseCase,
  UnlinkProblemIncidentUseCase,
} from './application/links/link-problem-incident.usecase';
import {
  LinkProblemRiskUseCase,
  ListProblemRiskLinksUseCase,
  UnlinkProblemRiskUseCase,
} from './application/links/link-problem-risk.usecase';
import { ListProblemsUseCase } from './application/list-problems.usecase';
import { ProblemActionOriginAccessor } from './application/problem-action-origin-accessor';
import { ProblemEvidenceSubjectAccessor } from './application/problem-evidence-subject-accessor';
import { TransitionProblemUseCase } from './application/transition-problem.usecase';
import { UpdateProblemUseCase } from './application/update-problem.usecase';
import { ProblemIncidentLinkRepositoryPort } from './domain/ports/problem-incident-link-repository.port';
import { ProblemLookupPort } from './domain/ports/problem-lookup.port';
import { ProblemReferenceDataPort } from './domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from './domain/ports/problem-repository.port';
import { ProblemRiskLinkRepositoryPort } from './domain/ports/problem-risk-link-repository.port';
import { registerProblemAuditAllowlists } from './domain/problem-audit-allowlist';
import { PrismaProblemIncidentLinkRepository } from './infrastructure/prisma-problem-incident-link.repository';
import { PrismaProblemReferenceDataRepository } from './infrastructure/prisma-problem-reference-data.repository';
import { PrismaProblemRiskLinkRepository } from './infrastructure/prisma-problem-risk-link.repository';
import { PrismaProblemRepository } from './infrastructure/prisma-problem.repository';
import { ProblemLookupRepository } from './infrastructure/problem-lookup.repository';
import { ProblemRelationshipController } from './presentation/problem-relationship.controller';
import { ProblemController } from './presentation/problem.controller';
import { ProblemMetricsModule } from './problem-metrics.module';
import { ProblemRiskLinkReadModule } from './problem-risk-link-read.module';

let collaborationRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    OrganizationsModule,
    IncidentDirectoryModule,
    ProblemRiskLinkReadModule,
    ProblemMetricsModule,
  ],
  controllers: [ProblemController, ProblemRelationshipController],
  providers: [
    CreateProblemUseCase,
    GetProblemUseCase,
    ListProblemsUseCase,
    UpdateProblemUseCase,
    TransitionProblemUseCase,
    ProblemEvidenceSubjectAccessor,
    ProblemActionOriginAccessor,
    ProblemParentRecordAccessor,
    LinkProblemRiskUseCase,
    UnlinkProblemRiskUseCase,
    ListProblemRiskLinksUseCase,
    LinkProblemIncidentUseCase,
    UnlinkProblemIncidentUseCase,
    ListProblemIncidentLinksUseCase,
    { provide: ProblemLookupPort, useClass: ProblemLookupRepository },
    { provide: ProblemRepositoryPort, useClass: PrismaProblemRepository },
    { provide: ProblemReferenceDataPort, useClass: PrismaProblemReferenceDataRepository },
    { provide: ProblemRiskLinkRepositoryPort, useClass: PrismaProblemRiskLinkRepository },
    { provide: ProblemIncidentLinkRepositoryPort, useClass: PrismaProblemIncidentLinkRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
  exports: [ProblemRepositoryPort, ProblemReferenceDataPort],
})
export class ProblemsModule {
  constructor(
    private readonly evidenceSubjectAccessor: ProblemEvidenceSubjectAccessor,
    private readonly actionOriginAccessor: ProblemActionOriginAccessor,
    private readonly parentRecordAccessor: ProblemParentRecordAccessor,
  ) {
    registerProblemAuditAllowlists();

    if (!collaborationRegistered) {
      collaborationRegistered = true;
      registerEvidenceSubjectResolver('PROBLEM', this.evidenceSubjectAccessor);
      registerActionOriginResolver('PROBLEM', this.actionOriginAccessor);

      registerAttachableEntityType('PROBLEM', this.parentRecordAccessor);
      registerCommentableEntityType('PROBLEM', this.parentRecordAccessor);
    }
  }
}
