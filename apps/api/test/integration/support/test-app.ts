/**
 * Builds a real Nest testing module wired against the actual test
 * database, for integration tests that exercise application services as
 * they really run (T031/T032 harness). Deliberately NOT the full
 * `AppModule` — HealthModule/ThrottlerModule/CacheModule etc. pull in
 * concerns unrelated to most integration specs. `baseImports` below
 * covers exactly what every integration test needs (config + the real
 * `PrismaService` + the real `AuditModule`); a spec that needs a specific
 * capability's module (e.g. `AuthorizationModule`, `OrganizationsModule`)
 * passes it via the `imports` option below rather than this file growing
 * a case for every capability.
 *
 * `ControlDirectoryModule` (`@Global()`, 003-controls-management/T011) is
 * baseline for the same reason `PrismaModule`/`AuditModule` are: it is
 * infrastructure wiring, not a business capability a spec opts into.
 * `RiskModule`'s `LinkControlUseCase`/`UnlinkControlUseCase`
 * (`application/links/control-link.usecase.ts`, F-46) inject
 * `ControlDirectoryPort` directly (ADR-020's composition-root wiring), and
 * every spec that imports `RiskModule` on its own (not the full
 * `AppModule`) needs that provider resolvable at bootstrap — Nest eagerly
 * instantiates every provider in the graph, so this is required even for a
 * spec that never touches control linking. (`PrismaControlRegistryRepository`
 * used to be the reason this comment gave — it also injected
 * `ControlDirectoryPort` — but that class, `ControlRegistryPort` and its
 * binding were dead code with no production caller, removed outright by
 * D-11/T009, 007-implementation-remediation; `ControlDirectoryModule`
 * stays baseline regardless, for the reason above.) Adding it here, once,
 * is what keeps `modules/risk`'s own source the ONLY thing this task
 * changed to satisfy "no other change to the Risk module" (this task's
 * scope) — the eleven `test/integration/*.spec.ts` files that import
 * `RiskModule` needed no edit of their own.
 *
 * `RiskControlLinkReadModule` (`@Global()`) is baseline for the mirror-image
 * reason: `ControlRelationshipModule`'s own `ListControlRiskLinksUseCase`
 * injects `RiskControlLinkReadPort`, bound by this module (owned by
 * `modules/risk`, the table's owner). Any spec that imports
 * `ControlRelationshipModule` directly (not the full `AppModule`) needs
 * that provider resolvable at bootstrap, same as `ControlDirectoryModule`
 * above.
 *
 * Importing `./env` FIRST is load-bearing: it redirects
 * `DATABASE_URL`/`DATABASE_MIGRATION_URL` at the test database before
 * `AppConfigModule`'s `ConfigModule.forRoot()` ever reads them (see that
 * file's comment). Every integration spec gets this transitively by
 * importing this module instead of constructing its own Nest context.
 */
import './env';

import { Test, type TestingModuleBuilder } from '@nestjs/testing';

import { AuditModule } from '../../../src/core/audit/audit.module';
import { AppConfigModule } from '../../../src/infrastructure/config/config.module';
import { PrismaModule } from '../../../src/infrastructure/prisma/prisma.module';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { AssetDirectoryModule } from '../../../src/modules/assets/asset-directory.module';
import { ControlDirectoryModule } from '../../../src/modules/controls/control-directory.module';
import { ControlEffectivenessModule } from '../../../src/modules/controls/control-effectiveness.module';
import { IncidentAssetLinkReadModule } from '../../../src/modules/incidents/incident-asset-link-read.module';
import { IncidentProcessLinkReadModule } from '../../../src/modules/incidents/incident-process-link-read.module';
import { IncidentRiskLinkReadModule } from '../../../src/modules/incidents/incident-risk-link-read.module';
import { ProblemRiskLinkReadModule } from '../../../src/modules/problems/problem-risk-link-read.module';
import { ProcessDirectoryModule } from '../../../src/modules/processes/process-directory.module';
import { RiskControlLinkReadModule } from '../../../src/modules/risk/risk-control-link-read.module';
import { RiskDirectoryModule } from '../../../src/modules/risk/risk-directory.module';

import type { INestApplication, ModuleMetadata } from '@nestjs/common';

export interface IntegrationTestContext {
  readonly app: INestApplication;
  readonly prisma: PrismaService;
  /** Tears down the Nest application (`app.close()`), which runs
   * `PrismaService.onModuleDestroy` and disconnects cleanly. Always call
   * this in `afterAll`/`afterEach`, never leave it dangling — each test
   * file opens its own connection pool. */
  close(): Promise<void>;
}

export interface BuildIntegrationTestingModuleOptions {
  /** Additional modules to import alongside the always-present
   * `AppConfigModule`/`PrismaModule`/`AuditModule` (e.g.
   * `AuthorizationModule`, `OrganizationsModule`) — for a spec that
   * exercises a specific capability end-to-end. */
  readonly imports?: ModuleMetadata['imports'];
  /** Lets a spec add/override individual providers (e.g. a fake) without
   * this shared harness needing to know about them. */
  readonly configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function buildIntegrationTestingModule(
  options: BuildIntegrationTestingModuleOptions = {},
): Promise<IntegrationTestContext> {
  let builder = Test.createTestingModule({
    imports: [
      AppConfigModule,
      PrismaModule,
      AuditModule,
      ControlDirectoryModule,
      // 004-compliance-management, T013-T015 — the second ADR-020 boundary
      // port pair (research.md D-9), baseline for the same reason
      // `ControlDirectoryModule` already is: infrastructure wiring, not a
      // business capability a spec opts into. `modules/compliance`'s own
      // `RequirementComplianceReaderService` injects
      // `ControlEffectivenessPort` at bootstrap; any integration spec that
      // imports `ComplianceModule` on its own (not the full `AppModule`)
      // needs it resolvable, the same reasoning already given above.
      ControlEffectivenessModule,
      RiskControlLinkReadModule,
      // 005-audit-findings, T060-T073 — the third ADR-020 boundary port,
      // baseline for the identical reason the two above are. `grc/finding`'s
      // `LinkFindingRiskUseCase` injects `RiskDirectoryPort` at bootstrap, so
      // any spec importing `FindingModule` on its own (rather than the whole
      // `AppModule`) cannot construct its injector without it.
      //
      // `@Global()` is about VISIBILITY once a module is in the graph, never
      // about being in the graph — a distinction this harness has now paid
      // for three times, and the reason each new boundary port lands here
      // rather than in whichever spec first trips over it.
      RiskDirectoryModule,
      // 006-assets-processes, Fase 5 (T034-T036) — the fourth and fifth
      // ADR-020 boundary ports, baseline for the identical reason. `modules
      // /risk`'s `LinkAssetUseCase`/`LinkProcessUseCase` and `modules/
      // controls`'s `LinkControlToAssetUseCase`/`LinkControlToProcessUseCase`
      // now inject `AssetDirectoryPort`/`ProcessDirectoryPort` at bootstrap
      // instead of reading `assets`/`processes` directly, so any spec
      // importing `RiskModule`/`ControlRelationshipModule` on its own needs
      // both resolvable.
      AssetDirectoryModule,
      ProcessDirectoryModule,
      // 013-incidents-problems-reverse-links — the sixth through ninth
      // ADR-020 boundary ports, baseline for the identical reason as every
      // one above: `modules/risk`'s `ListRiskIncidentLinksUseCase`/
      // `ListRiskProblemLinksUseCase`, `modules/assets`'s
      // `ListAssetIncidentLinksUseCase` and `modules/processes`'s
      // `ListProcessIncidentLinksUseCase` inject `IncidentRiskLinkReadPort`/
      // `ProblemRiskLinkReadPort`/`IncidentAssetLinkReadPort`/
      // `IncidentProcessLinkReadPort` at bootstrap, so any spec importing
      // `RiskModule`/`AssetsModule`/`ProcessesModule` on its own needs all
      // four resolvable.
      IncidentRiskLinkReadModule,
      IncidentAssetLinkReadModule,
      IncidentProcessLinkReadModule,
      ProblemRiskLinkReadModule,
      ...(options.imports ?? []),
    ],
  });

  if (options.configure) {
    builder = options.configure(builder);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  // Mirrors `main.ts`'s own `app.set('etag', false)` — see that line's
  // comment. Kept here too so a spec that does issue real HTTP requests
  // through this harness (a few do, via `supertest`) sees the same
  // behavior production does, rather than Express's default auto-ETag this
  // app deliberately turns off everywhere else. `app` is typed as the
  // generic `INestApplication` here (unlike the contract test harnesses'
  // `NestExpressApplication`) — that public type is used across every
  // caller of `buildIntegrationTestApp`, so this reaches into the
  // underlying Express instance directly rather than widening it.
  (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set(
    'etag',
    false,
  );
  await app.init();

  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
    },
  };
}
