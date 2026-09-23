import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { registerActionOriginResolver } from '../../grc/shared/domain/ports/action-origin-resolver.port';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';

import { CreateControlAssessmentUseCase } from './application/assessments/create-control-assessment.usecase';
import { DecideControlAssessmentAttestationUseCase } from './application/assessments/decide-control-assessment-attestation.usecase';
import { GetControlAssessmentUseCase } from './application/assessments/get-control-assessment.usecase';
import { ListControlAssessmentsUseCase } from './application/assessments/list-control-assessments.usecase';
import { RequestControlAssessmentAttestationUseCase } from './application/assessments/request-control-assessment-attestation.usecase';
import { ControlAssessmentActionOriginAccessor } from './application/collaboration/control-assessment-action-origin-accessor';
import { ControlAccessResolver } from './application/control-access-resolver.service';
import { registerControlAssessmentAuditAllowlists } from './control-assessment-audit-allowlist';
import { ControlAssessmentApprovalRepositoryPort } from './domain/ports/control-assessment-approval-repository.port';
import { ControlAssessmentRepositoryPort } from './domain/ports/control-assessment-repository.port';
import { ControlLookupPort } from './domain/ports/control-lookup.port';
import { ControlReferenceDataPort } from './domain/ports/control-reference-data.port';
import { ControlAssessmentApprovalRepository } from './infrastructure/control-assessment-approval.repository';
import { ControlAssessmentRepository } from './infrastructure/control-assessment.repository';
import { ControlLookupRepository } from './infrastructure/control-lookup.repository';
import { PrismaControlReferenceDataRepository } from './infrastructure/prisma-control-reference-data.repository';
import { ControlAssessmentController } from './presentation/control-assessment.controller';

let collaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule],
  controllers: [ControlAssessmentController],
  providers: [
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
    { provide: ControlLookupPort, useClass: ControlLookupRepository },
    { provide: ControlReferenceDataPort, useClass: PrismaControlReferenceDataRepository },
    { provide: ControlAssessmentRepositoryPort, useClass: ControlAssessmentRepository },
    {
      provide: ControlAssessmentApprovalRepositoryPort,
      useClass: ControlAssessmentApprovalRepository,
    },
    ControlAccessResolver,
    CreateControlAssessmentUseCase,
    ListControlAssessmentsUseCase,
    GetControlAssessmentUseCase,
    RequestControlAssessmentAttestationUseCase,
    DecideControlAssessmentAttestationUseCase,
    ControlAssessmentActionOriginAccessor,
  ],
})
export class ControlAssessmentModule {
  constructor(private readonly actionOriginAccessor: ControlAssessmentActionOriginAccessor) {
    registerControlAssessmentAuditAllowlists();

    if (!collaborationRegistered) {
      collaborationRegistered = true;
      registerActionOriginResolver('CONTROL_ASSESSMENT', this.actionOriginAccessor);
    }
  }
}
