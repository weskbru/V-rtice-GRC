/**
 * 008-incidents-problems — `IncidentsModule`, this module's own
 * composition root. Sits directly under `src/modules/incidents/`,
 * outside the `domain`/`application`/`infrastructure`/`presentation`
 * folders the boundary lint rules classify — exactly like
 * `assets.module.ts`/`controls.module.ts`, and for the same reason: this
 * is the one place allowed to bind a domain port to its infrastructure
 * implementation (ADR-011).
 *
 * ## Foundation, the origin accessor (spec.md FR-016), US1 and US3
 *
 * The module skeleton (tasks.md Fase 1/2) — schema, permission
 * definitions, audit field allow-list, `IncidentDirectoryModule` — landed
 * first; the foundation deliberately deferred `ActionOriginType.INCIDENT`
 * and its accessor rather than build a four-method, scope-filtered
 * registration untested at four in the morning (spec.md FR-016's own
 * dated note). `IncidentActionOriginAccessor` is that accessor, built the
 * next day with its own tests
 * (`test/integration/incident-problem-action-origin.spec.ts`) — see
 * that file's header for the live-scope proof and the refusal proof.
 *
 * `IncidentController` (US1: create/read/list/update/transition) and
 * `IncidentRelationshipController` (US3: the four relationship pairs,
 * built independently) both join here now (tasks.md T023-T027) —
 * `AuditModule` joins the imports (`AuditRecorder`, needed by every write
 * use case); `EntityCodeGeneratorPort`/`TransactionRunnerPort` are
 * declared by the GRC kernel (`grc/shared`) and bound to its Prisma
 * implementations here rather than reimplemented, the same reuse
 * `AssetsModule`'s own header documents — Incident contributes the `INC`
 * prefix to the kernel's closed registry (data-model.md §3), not a second
 * allocator.
 */
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

import { IncidentParentRecordAccessor } from './application/collaboration/incident-parent-record-accessor';
import { CreateIncidentUseCase } from './application/create-incident.usecase';
import { GetIncidentUseCase } from './application/get-incident.usecase';
import { IncidentActionOriginAccessor } from './application/incident-action-origin-accessor';
import { IncidentEvidenceSubjectAccessor } from './application/incident-evidence-subject-accessor';
import {
  LinkIncidentAssetUseCase,
  ListIncidentAssetLinksUseCase,
  UnlinkIncidentAssetUseCase,
} from './application/links/link-incident-asset.usecase';
import {
  LinkIncidentProcessUseCase,
  ListIncidentProcessLinksUseCase,
  UnlinkIncidentProcessUseCase,
} from './application/links/link-incident-process.usecase';
import {
  LinkIncidentRiskUseCase,
  ListIncidentRiskLinksUseCase,
  UnlinkIncidentRiskUseCase,
} from './application/links/link-incident-risk.usecase';
import { ListIncidentProblemLinksUseCase } from './application/links/list-incident-problem-links.usecase';
import { ListIncidentsUseCase } from './application/list-incidents.usecase';
import { TransitionIncidentUseCase } from './application/transition-incident.usecase';
import { UpdateIncidentUseCase } from './application/update-incident.usecase';
import { registerIncidentAuditAllowlists } from './domain/incident-audit-allowlist';
import { IncidentAssetLinkRepositoryPort } from './domain/ports/incident-asset-link-repository.port';
import { IncidentProblemLinkReadPort } from './domain/ports/incident-problem-link-read.port';
import { IncidentProcessLinkRepositoryPort } from './domain/ports/incident-process-link-repository.port';
import { IncidentReferenceDataPort } from './domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from './domain/ports/incident-repository.port';
import { IncidentRiskLinkRepositoryPort } from './domain/ports/incident-risk-link-repository.port';
import { IncidentAssetLinkReadModule } from './incident-asset-link-read.module';
import { IncidentDirectoryModule } from './incident-directory.module';
import { IncidentMetricsModule } from './incident-metrics.module';
import { IncidentProcessLinkReadModule } from './incident-process-link-read.module';
import { IncidentRiskLinkReadModule } from './incident-risk-link-read.module';
import { PrismaIncidentAssetLinkRepository } from './infrastructure/prisma-incident-asset-link.repository';
import { PrismaIncidentProblemLinkReadRepository } from './infrastructure/prisma-incident-problem-link-read.repository';
import { PrismaIncidentProcessLinkRepository } from './infrastructure/prisma-incident-process-link.repository';
import { PrismaIncidentReferenceDataRepository } from './infrastructure/prisma-incident-reference-data.repository';
import { PrismaIncidentRiskLinkRepository } from './infrastructure/prisma-incident-risk-link.repository';
import { PrismaIncidentRepository } from './infrastructure/prisma-incident.repository';
import { IncidentRelationshipController } from './presentation/incident-relationship.controller';
import { IncidentController } from './presentation/incident.controller';

let collaborationRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthorizationModule,
    OrganizationsModule,
    IncidentDirectoryModule,
    // 013-incidents-problems-reverse-links — this module OWNS
    // `IncidentRiskLink`/`IncidentAssetLink`/`IncidentProcessLink`, so it
    // provides the `@Global()` reverse-read bindings `modules/risk`/
    // `modules/assets`/`modules/processes` consume for their own
    // `GET /{riskId,assetId,processId}/incidents` — mirrors this same
    // module's own `IncidentDirectoryModule` import above.
    IncidentRiskLinkReadModule,
    IncidentAssetLinkReadModule,
    IncidentProcessLinkReadModule,
    // 009-indicators-reports, T027 — `IncidentMetricsModule` binds
    // `IncidentMetricsPort` to a fresh `PrismaIncidentRepository`, letting
    // `modules/indicators`'s Incident provider reuse the SAME catalog
    // query `GET /incidents` already runs. `IndicatorsModule` imports
    // `IncidentMetricsModule` directly rather than `IncidentsModule`
    // itself (see `incident-metrics.module.ts`'s own header for why it is
    // no longer `@Global()`).
    IncidentMetricsModule,
  ],
  controllers: [IncidentController, IncidentRelationshipController],
  providers: [
    IncidentEvidenceSubjectAccessor,
    IncidentActionOriginAccessor,
    IncidentParentRecordAccessor,
    // US1 — create/read/list/update/transition (this task's own scope).
    CreateIncidentUseCase,
    GetIncidentUseCase,
    ListIncidentsUseCase,
    UpdateIncidentUseCase,
    TransitionIncidentUseCase,
    // US3 — the five relationship links' write/read use cases (this
    // module's own three: Risk, Asset, Process, plus the read-only
    // Problem listing — see `application/links/`'s own file headers).
    LinkIncidentRiskUseCase,
    UnlinkIncidentRiskUseCase,
    ListIncidentRiskLinksUseCase,
    LinkIncidentAssetUseCase,
    UnlinkIncidentAssetUseCase,
    ListIncidentAssetLinksUseCase,
    LinkIncidentProcessUseCase,
    UnlinkIncidentProcessUseCase,
    ListIncidentProcessLinksUseCase,
    ListIncidentProblemLinksUseCase,
    { provide: IncidentRepositoryPort, useClass: PrismaIncidentRepository },
    { provide: IncidentReferenceDataPort, useClass: PrismaIncidentReferenceDataRepository },
    { provide: IncidentRiskLinkRepositoryPort, useClass: PrismaIncidentRiskLinkRepository },
    { provide: IncidentAssetLinkRepositoryPort, useClass: PrismaIncidentAssetLinkRepository },
    { provide: IncidentProcessLinkRepositoryPort, useClass: PrismaIncidentProcessLinkRepository },
    { provide: IncidentProblemLinkReadPort, useClass: PrismaIncidentProblemLinkReadRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class IncidentsModule {
  constructor(
    private readonly evidenceSubjectAccessor: IncidentEvidenceSubjectAccessor,
    private readonly actionOriginAccessor: IncidentActionOriginAccessor,
    private readonly parentRecordAccessor: IncidentParentRecordAccessor,
  ) {
    // Registers this module's own `AuditEntityType.INCIDENT` field
    // allow-list from its own file, without editing `core/audit/**`
    // (ADR-011) — mirrors `AssetsModule`'s own
    // `registerAssetAuditAllowlists()` call.
    registerIncidentAuditAllowlists();

    // Idempotency guard mirrors `ControlRelationshipModule`'s own
    // `collaborationRegistered` pattern — Nest may construct this module
    // more than once across a test run's several application contexts.
    if (!collaborationRegistered) {
      collaborationRegistered = true;
      registerEvidenceSubjectResolver('INCIDENT', this.evidenceSubjectAccessor);
      registerActionOriginResolver('INCIDENT', this.actionOriginAccessor);

      // CLAUDE.md §19.10 — `AttachableEntityType.INCIDENT`/
      // `CommentableEntityType.INCIDENT` existed in the schema with no
      // accessor ever registered against `core/comments/domain/
      // entity-registry.ts`: a legal enum value nobody wired up. This is
      // that registration, exercised by `test/integration/
      // incident-problem-collaboration.spec.ts`.
      registerAttachableEntityType('INCIDENT', this.parentRecordAccessor);
      registerCommentableEntityType('INCIDENT', this.parentRecordAccessor);
    }
  }
}
