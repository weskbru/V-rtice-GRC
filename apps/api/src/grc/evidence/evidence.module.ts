/**
 * T035/002-shared-grc-foundation, US1 — `EvidenceModule`, Evidence's own
 * composition root. Sits directly under `src/grc/evidence/`, outside the
 * `domain`/`application`/`infrastructure`/`presentation` folders the
 * boundary lint rules classify — exactly like every other module's own
 * `*.module.ts` (`risk.module.ts`'s own header). Depends INTO `core/**`
 * (`AuditModule`, `OrganizationsModule`, `AuthorizationModule`,
 * `PrismaModule`) and nothing under `modules/**` (ADR-016).
 *
 * ## `EvidenceLinkRepositoryPort` export — T051/005-audit-findings
 * (research.md D-9)
 *
 * `CloseFindingUseCase` (`grc/finding`) now consults
 * `hasActiveLinkForSubject` (Invariant F5, FR-010) — `grc/finding` imports
 * `EvidenceModule` directly for it, no intermediate port: both capabilities
 * live under `grc/**`, the one bucket the boundary lint rule
 * (`apps/api/eslint.config.mjs`) does not police internally (only
 * `core/** <-> grc/**` and `grc/** <-> modules/**` are guarded) — the same
 * reasoning already established by `FindingEvidenceSubjectAccessor`
 * importing `grc/evidence`'s closed type registry.
 */
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

// Same idempotency shape `RiskModule`/`registerRiskAuditAllowlists` already
// establish — several `test/integration/**` specs each build their OWN
// minimal Nest testing module importing `EvidenceModule` directly, and
// `registerAttachableEntityType` throws on a genuine second registration.
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
  // T051/005-audit-findings — `EvidenceLinkRepositoryPort` alone, not the
  // whole provider set: `FindingModule` needs Invariant F5's read
  // (`hasActiveLinkForSubject`), nothing else Evidence owns.
  exports: [EvidenceLinkRepositoryPort],
})
export class EvidenceModule {
  constructor(evidenceParentRecordAccessor: EvidenceParentRecordAccessor) {
    // T014 — idempotent across every capability under `grc/` that calls it
    // (see that file's own header); safe to call from here regardless of
    // which sibling module boots first.
    registerGrcAuditAllowlists();

    // The design correction this task applies: `EVIDENCE` registered
    // against the SAME attachable entity-type registry `RISK` already
    // proves, so a file reaches evidence through `POST /attachments`
    // (`entityType: EVIDENCE`) rather than a `fileId` column that could
    // never be populated (see `schema.prisma`'s own `Evidence` section
    // header for the full account).
    if (!evidenceCollaborationRegistered) {
      evidenceCollaborationRegistered = true;
      registerAttachableEntityType('EVIDENCE', evidenceParentRecordAccessor);
    }
  }
}
