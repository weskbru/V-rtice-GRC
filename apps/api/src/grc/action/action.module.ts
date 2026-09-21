/**
 * T054/002-shared-grc-foundation, US2 — `ActionModule`, Action's own
 * composition root. Sits directly under `src/grc/action/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify — exactly like `evidence.module.ts`. Depends
 * INTO `core/**` (`AuditModule`, `OrganizationsModule`,
 * `AuthorizationModule`, `PrismaModule`) and nothing under `modules/**`
 * (ADR-016).
 */
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

// Same idempotency shape `EvidenceModule` establishes — several
// `test/integration/**` specs each build their OWN minimal Nest testing
// module importing `ActionModule` directly, and
// `registerEvidenceSubjectResolver` throws on a genuine second
// registration.
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
  // Exported so `modules/risk`'s treatment-action use cases
  // (007-implementation-remediation, D-1/D-3/D-4) can create, edit and
  // transition the shared `Action` DIRECTLY — no mirror any more — from
  // their own composition root, without re-instantiating this module's
  // providers (ADR-016: `grc/**` never imports `modules/**`, but the
  // reverse is allowed and expected).
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
    // T014 — idempotent across every capability under `grc/` that calls it
    // (see that file's own header); safe to call from here regardless of
    // which sibling module boots first.
    registerGrcAuditAllowlists();

    // T045a — `EVIDENCE` was already registered by `EvidenceModule` for the
    // ATTACHABLE-entity registry (files reaching evidence); THIS is the
    // separate `EvidenceSubjectResolverPort` registry (evidence LINKED to a
    // subject) — `ACTION` is a new member of the closed
    // `EvidenceSubjectType` enum that had no consumer until this task (see
    // `evidence-subject-resolver.port.ts`'s own header, "Who registers
    // what").
    if (!actionCollaborationRegistered) {
      actionCollaborationRegistered = true;
      registerEvidenceSubjectResolver('ACTION', actionEvidenceSubjectAccessor);
    }
  }
}
