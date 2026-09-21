/**
 * T027-T035/003-controls-management, User Story 2 — `ControlAssessmentModule`,
 * this workstream's own composition root for assessments and attestation
 * (operations 7-11 of `contracts/controls.openapi.yaml`). Sits directly
 * under `src/modules/controls/`, outside the `domain/application/
 * infrastructure/presentation` folders the boundary lint rules classify —
 * exactly like `controls.module.ts`/`control-directory.module.ts`.
 *
 * ## Why this is its own module, not added to `controls.module.ts`
 *
 * This task's own instructions forbid editing `controls.module.ts` (owned
 * by the concurrent catalogue/lifecycle workstream, T018-T026). This
 * module is therefore a SEPARATE Nest module carrying its own controller
 * and every provider that controller's use cases need — Nest registers a
 * module's `controllers` regardless of which OTHER module imports it, as
 * long as it is reachable from the root module, so wiring this into
 * `AppModule` directly (see `app.module.ts`) is sufficient; the
 * coordinator may later fold it into `controls.module.ts`'s own `imports`
 * if that turns out to read better once both workstreams have landed.
 *
 * ## Task C registrations, performed in this module's constructor
 *
 * The `CONTROL_ASSESSMENT` action origin type is registered here against
 * the shared resolver registry — the exact shape `RiskModule`'s own
 * constructor already establishes for its own origin type, and
 * `FindingModule`'s for its own. Also calls
 * `registerControlAssessmentAuditAllowlists()` — see that file's header
 * for why it is a SEPARATE registration function from
 * `registerControlAuditAllowlists()` (the catalogue/lifecycle
 * workstream's own).
 */
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

// `RiskModule`'s constructor runs every time a NestJS testing module
// (`Test.createTestingModule({ imports: [ControlAssessmentModule] })`)
// instantiates it — once per spec FILE within the same worker process,
// not once per process — so the one-time registry call below needs its
// own idempotency guard, mirroring `risk.module.ts`'s own
// `collaborationEntityTypesRegistered` flag exactly.
let collaborationRegistered = false;

@Module({
  imports: [PrismaModule, AuditModule, OrganizationsModule, AuthorizationModule],
  controllers: [ControlAssessmentController],
  providers: [
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
    { provide: ControlLookupPort, useClass: ControlLookupRepository },
    // `ControlReferenceDataPort` is the catalogue/lifecycle workstream's
    // own small, stable port (`domain/ports/control-reference-data.port.ts`,
    // T020) — reused here (not re-declared) for actor lookups, avoiding a
    // second "look up a user by id" implementation (CLAUDE.md §13.8).
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
