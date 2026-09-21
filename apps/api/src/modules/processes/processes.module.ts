/**
 * T010,T017-T022/006-assets-processes — `ProcessesModule`, this module's
 * own composition root. Identical in shape and reasoning to
 * `modules/assets/assets.module.ts` (FR-020) — see that file's header for
 * the full account this one does not repeat. Contributes the `PRC` prefix
 * to the GRC kernel's closed code-allocator registry.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { IncidentProcessLinkReadModule } from '../incidents/incident-process-link-read.module';

import { CreateProcessUseCase } from './application/create-process.usecase';
import { DeactivateProcessUseCase } from './application/deactivate-process.usecase';
import { GetProcessUseCase } from './application/get-process.usecase';
import { ListProcessIncidentLinksUseCase } from './application/list-process-incident-links.usecase';
import { ListProcessesUseCase } from './application/list-processes.usecase';
import { ReactivateProcessUseCase } from './application/reactivate-process.usecase';
import { UpdateProcessUseCase } from './application/update-process.usecase';
import { ProcessReferenceDataPort } from './domain/ports/process-reference-data.port';
import { ProcessRepositoryPort } from './domain/ports/process-repository.port';
import { registerProcessAuditAllowlists } from './domain/process-audit-allowlist';
import { PrismaProcessReferenceDataRepository } from './infrastructure/prisma-process-reference-data.repository';
import { PrismaProcessRepository } from './infrastructure/prisma-process.repository';
import { ProcessController } from './presentation/process.controller';
import { ProcessDirectoryModule } from './process-directory.module';
import { ProcessMetricsModule } from './process-metrics.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OrganizationsModule,
    AuthorizationModule,
    ProcessDirectoryModule,
    // 009-indicators-reports, T025 — `ProcessMetricsModule` binds
    // `ProcessMetricsPort` to a fresh `PrismaProcessRepository`, letting
    // `modules/indicators`'s Process provider reuse the SAME catalog query
    // `GET /processes` already runs. `IndicatorsModule` imports
    // `ProcessMetricsModule` directly rather than `ProcessesModule` itself
    // (see `process-metrics.module.ts`'s own header for why it is no
    // longer `@Global()`).
    ProcessMetricsModule,
    // 013-incidents-problems-reverse-links —
    // `IncidentProcessLinkReadModule` binds `IncidentProcessLinkReadPort`
    // to `modules/incidents`' own adapter. This module imports it
    // directly so `ListProcessIncidentLinksUseCase` (below) can inject
    // that port without either module importing the other (CLAUDE.md
    // §19.10 — a partial Nest test graph must not depend on global
    // provider visibility).
    IncidentProcessLinkReadModule,
  ],
  controllers: [ProcessController],
  providers: [
    CreateProcessUseCase,
    GetProcessUseCase,
    UpdateProcessUseCase,
    ListProcessesUseCase,
    DeactivateProcessUseCase,
    ReactivateProcessUseCase,
    // 013-incidents-problems-reverse-links — read-only reverse of
    // `IncidentProcessLink`, owned by `modules/incidents`; injected via
    // `IncidentProcessLinkReadModule`, imported directly above.
    ListProcessIncidentLinksUseCase,
    { provide: ProcessRepositoryPort, useClass: PrismaProcessRepository },
    { provide: ProcessReferenceDataPort, useClass: PrismaProcessReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
  ],
})
export class ProcessesModule {
  constructor() {
    registerProcessAuditAllowlists();
  }
}
