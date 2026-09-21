/**
 * T036-T042/003-controls-management, User Story 3 — `ControlRelationshipModule`,
 * this workstream's own composition root for process/asset links and the
 * read-only risk-link listing (operations 12-18 of
 * `contracts/controls.openapi.yaml`). Sits directly under
 * `src/modules/controls/` — see `control-assessment.module.ts`'s own
 * header for the full account of why this is a separate module rather
 * than an edit to `controls.module.ts`, and for the Task C registration
 * idempotency pattern this file repeats for
 * `registerEvidenceSubjectResolver('CONTROL', ...)`.
 *
 * `ListControlRiskLinksUseCase` (below) depends on `RiskControlLinkReadPort`
 * (`shared/grc-ports/risk-control-link-read.port.ts`, ADR-020 part 3), but
 * this module does not bind it: `modules/risk/risk-control-link-read.module.ts`
 * (`@Global()`, imported by `RiskModule`) provides that binding for the
 * whole application, exactly the relationship this module has with
 * `ControlDirectoryModule` in the opposite direction — see that module's
 * own header.
 *
 * This module deliberately does NOT import `RiskControlLinkReadModule`
 * directly, unlike every other `*LinkReadModule` consumer in this codebase
 * (CLAUDE.md §19.10): `controls-risk-module-boundary.spec.ts` (SC-007) is a
 * static, filesystem-level guard asserting that no file under
 * `modules/controls` imports anything from `modules/risk`'s directory tree
 * at all — including this thin port module, which physically lives under
 * `modules/risk/`. `@Global()` is therefore still the correct mechanism
 * here, and this module stays exposed to the same latent risk §19.10 warns
 * about: a future test that overrides `RiskModule` in a partial graph
 * would fail to resolve `RiskControlLinkReadPort` here. Moving the port
 * module out of `modules/risk` (e.g. into `shared/grc-ports` alongside the
 * port interface itself) would resolve it, but that is a boundary decision
 * for the coordinator, not a call this file makes unilaterally.
 */
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
