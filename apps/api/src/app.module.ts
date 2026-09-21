import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuditModule } from './core/audit/audit.module';
import { AuthorizationModule } from './core/authorization/authorization.module';
import { PermissionGuard } from './core/authorization/presentation/permission.guard';
import { CommentsModule } from './core/comments/comments.module';
import { DashboardModule } from './core/dashboard/dashboard.module';
import { FilesModule } from './core/files/files.module';
import { IdentityModule } from './core/identity/identity.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { OrganizationsModule } from './core/organizations/organizations.module';
import { MandatoryPasswordChangeGuard } from './core/sessions/presentation/mandatory-password-change.guard';
import { SessionGuard } from './core/sessions/presentation/session.guard';
import { SessionsModule } from './core/sessions/sessions.module';
import { ActionModule } from './grc/action/action.module';
import { EvidenceModule } from './grc/evidence/evidence.module';
import { FindingModule } from './grc/finding/finding.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { AppConfigService } from './infrastructure/config/app-config.service';
import { AppConfigModule } from './infrastructure/config/config.module';
import { HealthModule } from './infrastructure/health/health.module';
import { CsrfMiddleware } from './infrastructure/http/csrf.middleware';
import { ProblemDetailsFilter } from './infrastructure/http/problem-details.filter';
import { createValidationPipe } from './infrastructure/http/validation';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { RequestContextMiddleware } from './infrastructure/logging/request-context';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AuditEngagementsModule } from './modules/audit-engagements/audit-engagements.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ControlAssessmentModule } from './modules/controls/control-assessment.module';
import { ControlRelationshipModule } from './modules/controls/control-relationship.module';
import { ControlsModule } from './modules/controls/controls.module';
import { DashboardSummaryModule } from './modules/dashboard/dashboard-summary.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RiskModule } from './modules/risk/risk.module';

@Module({
  imports: [
    // Order matters only for readability here — Nest resolves providers by
    // dependency graph, not import order — but AppConfigModule is listed
    // first because every other infrastructure module depends on
    // AppConfigService.
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    AuditModule,
    CacheModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        throttlers: [
          {
            ttl: appConfig.throttle.ttlSeconds * 1000,
            limit: appConfig.throttle.limit,
          },
        ],
      }),
    }),
    HealthModule,
    AuthorizationModule,
    OrganizationsModule,
    SessionsModule,
    IdentityModule,
    CommentsModule,
    DashboardModule,
    FilesModule,
    NotificationsModule,
    ActionModule,
    RiskModule,
    EvidenceModule,
    FindingModule,
    // 003-controls-management — imports `ControlDirectoryModule`
    // (`@Global()`) transitively, which is what lets `RiskModule`'s
    // `LinkControlUseCase`/`UnlinkControlUseCase` (F-46) inject
    // `ControlDirectoryPort` without either module importing the other
    // (ADR-020 part 3, SC-007). (`PrismaControlRegistryRepository` used to
    // be the reason cited here — it also injected `ControlDirectoryPort` —
    // but that class and its binding were dead code, removed by D-11/T009,
    // 007-implementation-remediation.)
    ControlsModule,
    // T027-T042/003-controls-management, User Story 2/3 — this workstream's
    // own composition roots (assessments/attestation, and process/asset/
    // risk relationships). Separate modules rather than additions to
    // `controls.module.ts` (owned by the concurrent catalogue/lifecycle
    // workstream) — see `control-assessment.module.ts`'s own header.
    ControlAssessmentModule,
    ControlRelationshipModule,
    // 004-compliance-management — the third business module. Imported
    // AFTER ControlsModule so `ControlDirectoryModule`/
    // `ControlEffectivenessModule` (both `@Global()`, registered by
    // `ControlsModule`'s own composition root) are already live in the
    // application-wide injector by the time `ComplianceModule`'s own
    // providers (`RequirementComplianceReaderService`) resolve
    // `ControlDirectoryPort`/`ControlEffectivenessPort` (research.md D-9).
    ComplianceModule,
    // 005-audit-findings — the fourth business module. Imported AFTER
    // RiskModule/ControlsModule/ComplianceModule so `RiskDirectoryModule`/
    // `ControlDirectoryModule`/`ComplianceDirectoryModule` (all `@Global()`,
    // registered by their own owning composition roots) are already live
    // in the application-wide injector by the time this module's own
    // scope-link use cases resolve `RiskDirectoryPort`/`ControlDirectoryPort`/
    // `FrameworkVersionDirectoryPort`/`RequirementDirectoryPort`
    // (research.md D-11). This task registers NO controllers (T040/T041,
    // out of this task's own scope — see `audit-engagements.module.ts`'s
    // own header).
    AuditEngagementsModule,
    // 006-assets-processes, Fase 2 — the fifth and sixth business modules,
    // promoted from the two minimal registries `modules/risk`/
    // `modules/controls` used to read directly (data-model.md §8). Neither
    // registers a controller yet (Fase 3's own scope) — imported here now
    // so `AssetDirectoryModule`/`ProcessDirectoryModule` (both `@Global()`,
    // registered by these modules' own composition roots) are live in the
    // application-wide injector, and so each module's own
    // `AuditEntityType.ASSET`/`PROCESS` field allow-list is registered on
    // application bootstrap (T014), the same shape every prior business
    // module addition above follows.
    AssetsModule,
    ProcessesModule,
    // 008-incidents-problems, foundation — the seventh and eighth business
    // modules. Foundation scope only (tasks.md Fase 1/2): schema,
    // permissions, audit allow-lists, and `IncidentDirectoryModule`
    // (`@Global()`, registered by `IncidentsModule`'s own composition
    // root) — no controller yet (Fase 3-4's own scope). Imported here,
    // `IncidentsModule` BEFORE `ProblemsModule`, so `IncidentDirectoryPort`
    // is already live in the application-wide injector by the time a
    // future `modules/problems` use case resolves it (research.md D-14) —
    // though `ProblemsModule` also imports `IncidentDirectoryModule`
    // directly (its own header explains why relying on import order alone
    // is not enough here).
    IncidentsModule,
    ProblemsModule,
    // 009-indicators-reports, Fase 2 — the ninth and tenth business
    // modules. Foundation scope only (tasks.md Fase 2): permissions
    // (T008/T009, another workstream), `IndicatorParentRecordAccessor`
    // registered against `CommentableEntityType.INDICATOR` (T010), audit
    // allow-lists (T011), and the two modules' read-only, unscoped
    // repositories (T014, research.md D-8) — no controller yet (Fase 3-5's
    // own scope). `IndicatorsModule` registers the entity-registry
    // accessor in its own constructor on bootstrap, the same shape
    // `IncidentsModule` above already follows for `INCIDENT`.
    IndicatorsModule,
    ReportsModule,
    // `GET /dashboard/summary` — the cross-domain GRC summary
    // (`GetDashboardSummaryUseCase`'s own header). Imported AFTER
    // `IndicatorsModule`/`ReportsModule` for the same reason
    // `ReportsModule` itself is imported after `IndicatorsModule`: this
    // module's own composition root binds `IndicatorCalculationPort` from
    // `IndicatorsModule`'s exported `IndicatorCalculationService`
    // (research.md D-9's ordering discipline, restated here).
    DashboardSummaryModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    // Global guard chain (T064). Order is load-bearing and follows this
    // providers array's declaration order (Nest runs multiple `APP_GUARD`
    // entries in registration order, ANDing their results — the first one
    // to return `false`/throw stops the chain):
    //
    //   1. `ThrottlerGuard` (T024) — blunt, method-agnostic abuse
    //      protection, unrelated to identity; no reason to defer it behind
    //      authentication.
    //   2. `SessionGuard` (T064) — resolves the caller's session (or
    //      rejects/bypasses via `@Public()`) and enriches `RequestContext`
    //      with `actorUserId`/`sessionId`/`authMethod`.
    //   3. `MandatoryPasswordChangeGuard` (S-01, audit A6-F01) — reads the
    //      session (2) already attached to the request and refuses every
    //      route other than a small, explicit allowlist
    //      (`@AllowedDuringMandatoryPasswordChange()`) while
    //      `LocalCredential.mustChangePassword` is `true` for the caller.
    //      Must run AFTER (2), which is what resolves the session this
    //      guard reads, and BEFORE (4), so a refusal here is reported as
    //      "you must change your password" rather than folded into an
    //      unrelated permission decision.
    //   4. `PermissionGuard` (existing, T035) — reads
    //      `RequestContext.actorUserId` (via `CurrentActorPort`), which is
    //      ONLY populated because (2) already ran. Running this before (2)
    //      would make every non-`@Public()` route see "no actor" and fail
    //      closed for the wrong reason.
    //
    // `useExisting` (not `useClass`) for all three: `SessionGuard`/
    // `MandatoryPasswordChangeGuard`/`PermissionGuard` are already fully
    // wired, singleton instances inside `SessionsModule`/`AuthorizationModule`
    // (which export them) — reusing that instance is what lets each guard's
    // own dependencies (not themselves exported by those modules) resolve
    // correctly, rather than Nest trying to construct a second instance in
    // `AppModule`'s own injector scope.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: SessionGuard },
    { provide: APP_GUARD, useExisting: MandatoryPasswordChangeGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
    // `consumer.apply(CsrfMiddleware)` below resolves it through THIS
    // module's own DI container, so it must be a plain provider here (not
    // just imported) — it is not itself an `APP_*` special token.
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Must run before everything else so RequestContext (correlation id,
    // IP, user agent) is available to every guard, pipe, interceptor,
    // controller and the global exception filter (ADR-005, ADR-012, T019).
    consumer.apply(RequestContextMiddleware).forRoutes('*');
    // CSRF (T065, ADR-002) — after RequestContext (so a rejection is still
    // attributable to a correlation id) but, like all middleware, still
    // before every guard above (Express middleware always precedes Nest
    // guards in the request lifecycle) — a cross-origin state-changing
    // request never even reaches SessionGuard/PermissionGuard/ThrottlerGuard.
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
