/**
 * T074/002-shared-grc-foundation, US3 — `FindingModule`, Finding's own
 * composition root. Sits directly under `src/grc/finding/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify — exactly like `evidence.module.ts`/
 * `action.module.ts`. Depends INTO `core/**` (`AuditModule`,
 * `OrganizationsModule`, `AuthorizationModule`, `PrismaModule`) and
 * nothing under `modules/**` (ADR-016).
 *
 * ## `exports`, added for T042/005-audit-findings
 *
 * `CreateFindingUseCase` and `FindingRepositoryPort` are exported so
 * `modules/audit-engagements` (`CreateFindingFromEngagementUseCase`,
 * `ListAuditEngagementFindingsUseCase`) can depend on them directly —
 * the accepted "business modules may depend on the GRC kernel" direction
 * (ADR-016, `apps/api/eslint.config.mjs`), the same shape `modules/risk`
 * already uses for `grc/action`. Nothing else here is exported: every
 * other provider remains this module's own internal composition detail.
 */
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

// Same idempotency shape `EvidenceModule`/`ActionModule` establish —
// several `test/integration/**` specs each build their OWN minimal Nest
// testing module importing `FindingModule` directly, and
// `registerEvidenceSubjectResolver`/`registerActionOriginResolver` throw
// on a genuine second registration.
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
    // T014 — idempotent across every capability under `grc/` that calls it
    // (see that file's own header); safe to call from here regardless of
    // which sibling module boots first.
    registerGrcAuditAllowlists();

    // T072 — `FINDING` is a new member of both closed enums
    // (`EvidenceSubjectType`, `ActionOriginType`) that had no consumer
    // until this task: registering both here is what gives a finding
    // evidence and remediation (FR-023).
    if (!findingCollaborationRegistered) {
      findingCollaborationRegistered = true;
      registerEvidenceSubjectResolver('FINDING', findingEvidenceSubjectAccessor);
      registerActionOriginResolver('FINDING', findingActionOriginAccessor);
    }
  }
}
