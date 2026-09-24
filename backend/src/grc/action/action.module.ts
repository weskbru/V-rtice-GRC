import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { registerGrcAuditAllowlists } from '../shared/domain/grc-audit-allowlist';
import { EntityCodeGeneratorPort } from '../shared/domain/ports/entity-code-generator.port';
import { registerEvidenceSubjectResolver } from '../shared/domain/ports/evidence-subject-resolver.port';
import { PrismaEntityCodeGenerator } from '../shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../shared/infrastructure/prisma-transaction-runner';

import { ActionOriginLabelService } from './application/action-origin-label.service';
import { ActionEvidenceSubjectAccessor } from './application/collaboration/action-evidence-subject-accessor';
import { CreateActionUseCase } from './application/create-action.usecase';
import { GetActionUseCase } from './application/get-action.usecase';
import { ListActionAuditEventsUseCase } from './application/list-action-audit-events.usecase';
import { ListActionUseCase } from './application/list-action.usecase';
import { TransitionActionUseCase } from './application/transition-action.usecase';
import { UpdateActionUseCase } from './application/update-action.usecase';
import { ActionReferenceDataPort } from './domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from './domain/ports/action-repository.port';
import { PrismaActionReferenceDataRepository } from './infrastructure/prisma-action-reference-data.repository';
import { PrismaActionRepository } from './infrastructure/prisma-action.repository';
import { ActionAuditController } from './presentation/action-audit.controller';
import { ActionController } from './presentation/action.controller';

let actionCollaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule],
  controllers: [ActionController, ActionAuditController],
  providers: [
    CreateActionUseCase,
    ListActionUseCase,
    GetActionUseCase,
    UpdateActionUseCase,
    TransitionActionUseCase,
    ListActionAuditEventsUseCase,
    ActionOriginLabelService,
    ActionEvidenceSubjectAccessor,
    { provide: ActionRepositoryPort, useClass: PrismaActionRepository },
    { provide: ActionReferenceDataPort, useClass: PrismaActionReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
  exports: [
    CreateActionUseCase,
    GetActionUseCase,
    ListActionUseCase,
    UpdateActionUseCase,
    TransitionActionUseCase,
    ActionRepositoryPort,
  ],
})
export class ActionModule {
  constructor(actionEvidenceSubjectAccessor: ActionEvidenceSubjectAccessor) {
    registerGrcAuditAllowlists();

    if (!actionCollaborationRegistered) {
      actionCollaborationRegistered = true;
      registerEvidenceSubjectResolver('ACTION', actionEvidenceSubjectAccessor);
    }
  }
}
