/**
 * 008-incidents-problems — `ProblemsModule`, this module's own
 * composition root. Mirrors `IncidentsModule`'s own header — see that
 * file for the reasoning (foundation scope, then the origin accessor
 * built the next day) this one deliberately does not repeat.
 *
 * Imports `IncidentDirectoryModule` (`@Global()`, registered by
 * `modules/incidents`'s own composition root) explicitly — not merely
 * relying on `app.module.ts`'s import order — so `IncidentDirectoryPort`
 * is resolvable from this module's own injector the moment Fase 5's
 * `LinkProblemIncidentUseCase` (tasks.md T053f) is added, without either
 * module importing the other (research.md D-14, ADR-011). `@Global()`
 * registration happens once regardless of how many places import it, so
 * importing it here and from `AppModule` is not a duplication hazard.
 *
 * US2 (create/read/list/update/transition, this pass): adds
 * `AuditModule` (for `AuditRecorder`, every business write's own
 * transaction-scoped audit event) and the GRC kernel's shared
 * `EntityCodeGeneratorPort`/`TransactionRunnerPort` bindings — the same
 * two shared-kernel bindings `ControlsModule`'s own header explains
 * (`modules/** -> grc/**` is a permitted direction; Problems contributes
 * the `PRB` prefix to the kernel's closed registry, it does not
 * contribute a second allocator or a second transaction runner).
 *
 * `ProblemController` (catalogue/lifecycle, operations 1-2/4-5 of
 * contracts/problems.openapi.yaml) is registered here. Link routes
 * (operations 3, 6-9 — Problem<->Risk, Problem<->Incident) are a SEPARATE
 * controller/use-case set, `ProblemRelationshipController` — built by the
 * parallel relationship front (coordinator instruction 2026-09-11) and
 * registered below, alongside this pass's own lifecycle wiring, once both
 * landed in the same working tree.
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
    // 013-incidents-problems-reverse-links — this module OWNS
    // `ProblemRiskLink`, so it provides the `@Global()` reverse-read
    // binding `modules/risk` consumes for its own
    // `GET /risks/{riskId}/problems` — mirrors
    // `modules/incidents`' own `IncidentRiskLinkReadModule` import.
    ProblemRiskLinkReadModule,
    // 009-indicators-reports, T028 — `ProblemMetricsModule` binds
    // `ProblemMetricsPort` to a fresh `PrismaProblemRepository`, letting
    // `modules/indicators`'s Problem provider reuse the SAME catalog query
    // `GET /problems` already runs. `IndicatorsModule` imports
    // `ProblemMetricsModule` directly rather than `ProblemsModule` itself
    // (see `problem-metrics.module.ts`'s own header for why it is no
    // longer `@Global()`).
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
    // US3 — the fifth link (Problem<->Incident, N:M, owned here) plus
    // Problem<->Risk (see `application/links/`'s own file headers).
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

      // CLAUDE.md §19.10 — `AttachableEntityType.PROBLEM`/
      // `CommentableEntityType.PROBLEM` existed in the schema (the
      // registry's own worked-example comment even names `PROBLEM`
      // specifically) with no accessor ever registered. This is that
      // registration, exercised by `test/integration/
      // incident-problem-collaboration.spec.ts`.
      registerAttachableEntityType('PROBLEM', this.parentRecordAccessor);
      registerCommentableEntityType('PROBLEM', this.parentRecordAccessor);
    }
  }
}
