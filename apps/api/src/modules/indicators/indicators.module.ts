/**
 * 009-indicators-reports, Fase 2 (T010/T014) + Fase 3 (T019-T029) + Fase 4
 * (T035/T036) — `IndicatorsModule`, this module's own composition root.
 * Fase 4 adds `IndicatorMeasurementRepositoryPort` (bound to
 * `PrismaIndicatorMeasurementRepository`) and US2's two use cases
 * (`CreateIndicatorMeasurementUseCase`/`ListIndicatorMeasurementsUseCase`),
 * both consuming the SAME `IndicatorCalculationService`/`AuditRecorder`/
 * `ScopeResolverService` already imported below for Fase 3 — no new
 * module import was needed for this phase. Sits directly
 * under `src/modules/indicators/`, outside the `domain`/`application`/
 * `infrastructure`/`presentation` folders the boundary lint rules classify
 * — exactly like `IncidentsModule`/`AssetsModule`, and for the same
 * reason: this is the one place allowed to bind a domain port to its
 * infrastructure implementation (ADR-011).
 *
 * ## Foundation (tasks.md Fase 2's own scope)
 *
 *   - `IndicatorDefinitionRepositoryPort` bound to its Prisma
 *     implementation (T014) — read-only, no `ScopeFilter` (research.md
 *     D-8), the foundation Fase 3's use cases and this module's own
 *     `IndicatorParentRecordAccessor` both depend on.
 *   - `IndicatorParentRecordAccessor` (T010), registered against
 *     `CommentableEntityType.INDICATOR` — and ONLY that registry
 *     (`registerCommentableEntityType`), never
 *     `registerAttachableEntityType` (spec.md FR-033: Indicator is
 *     commentable, never attachable).
 *
 * ## Fase 3 (T019-T029) — the eleven metric providers and their calculator
 *
 * Every `*IndicatorMetricProvider` (`application/metric-providers/*`) is
 * registered as a plain provider here, and **NONE of them appears in
 * `exports`** — only `IndicatorCalculationService` does. This is the
 * structural half of CLAUDE.md §19.7 ("nenhum provider é chamado de
 * nenhum outro lugar do código"): Nest resolves a provider for whichever
 * class asks for it in its constructor, and the only class in this
 * module's dependency graph that asks for a provider is
 * `IndicatorCalculationService` itself (see that file's own header for the
 * full reasoning). A future controller/use-case module can only reach a
 * provider by injecting `IndicatorCalculationService` — never a provider
 * directly, because nothing outside this module can resolve one.
 *
 * `FindingModule`/`ActionModule` are imported directly (ADR-016 — a
 * business module may depend on the GRC kernel, the same way
 * `RiskModule`/`AuditEngagementsModule` already import `ActionModule`/
 * `FindingModule`) so `FindingOpenCountBySeverityProvider`/
 * `ActionOverdueCountProvider` can inject `FindingRepositoryPort`/
 * `ActionRepositoryPort` directly — no `shared/grc-ports` boundary port
 * needed for either (research.md D-4's own table: only the eight
 * business-module-sourced keys need one). The other eight scoped
 * providers, plus the one organization-wide Compliance provider, depend on
 * boundary ports bound by eight tiny `*MetricsModule`/`ComplianceSummaryModule`
 * modules (`RiskDashboardMetricsPort`, `ControlMetricsPort`,
 * `AssetMetricsPort`, `ProcessMetricsPort`, `AuditEngagementMetricsPort`,
 * `IncidentMetricsPort`, `ProblemMetricsPort`, `ComplianceSummaryPort`).
 *
 * These eight are imported directly below, rather than left to `@Global()`
 * provider visibility. Each module used to be `@Global()`, relying on its
 * OWNING module (e.g. `ControlsModule`) having already been imported
 * somewhere in the same graph to make its export visible everywhere —
 * true for the full `AppModule`, but false in a Nest test context that
 * assembles only a subset of modules, or that overrides the owning module
 * entirely (`test/contract/support/controls-contract-app.ts` replaces
 * `ControlsModule` wholesale, dropping its transitive
 * `ControlMetricsModule` import along with it). That is CLAUDE.md
 * §19.10's exact shape: an extension point that only worked because
 * nothing had exercised it outside the one graph it happened to be built
 * against. Importing each module here directly removes the dependency on
 * import order elsewhere, and each of the eight modules no longer
 * declares `@Global()` itself, since nothing but `IndicatorsModule` and
 * its owning module ever needed it — see each module's own header.
 *
 * ## Fase 3 (T018/T030/T031) — US1's three HTTP operations
 *
 * `AuditModule`/`OrganizationsModule` join the imports (`AuditRecorder` for
 * `CreateIndicatorDefinitionUseCase`'s creation audit, FR-013;
 * `ScopeResolverService` for `GetIndicatorCurrentValueUseCase`'s "resolve
 * escopo uma vez", FR-005) — the same two core capabilities every other
 * business module's own composition root already imports for the same
 * reason (`IncidentsModule`). `EntityCodeGeneratorPort`/
 * `TransactionRunnerPort` are bound here, not exported: nothing outside
 * this module allocates an `IND-` code or runs a transaction on this
 * module's behalf.
 *
 * ## Fase 5 (T039-T042) — the threshold-breach notification
 *
 * `NotificationsModule` joins the imports below EXPLICITLY, in the
 * `imports` array, never relied upon via `@Global()` provider visibility
 * from some other module elsewhere in the graph — the same explicit-
 * import discipline this file's own header already applies to the eight
 * `*MetricsModule`s above (commit `8135915`) and for the identical reason:
 * a Nest test context that assembles only a subset of modules must not
 * silently lose `NotificationService`'s availability depending on import
 * order. `CreateIndicatorMeasurementUseCase` (T035/T039) is the only
 * consumer; see that file's own header for why and where it calls
 * `NotificationService.notify`.
 */
import { Module } from '@nestjs/common';

import { AuditModule } from '../../core/audit/audit.module';
import { AuthorizationModule } from '../../core/authorization/authorization.module';
import { registerCommentableEntityType } from '../../core/comments/domain/entity-registry';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { OrganizationsModule } from '../../core/organizations/organizations.module';
import { ActionModule } from '../../grc/action/action.module';
import { FindingModule } from '../../grc/finding/finding.module';
import { registerActionOriginResolver } from '../../grc/shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../../grc/shared/domain/ports/entity-code-generator.port';
import { PrismaEntityCodeGenerator } from '../../grc/shared/infrastructure/prisma-entity-code-generator';
import { GrcTransactionRunner } from '../../grc/shared/infrastructure/prisma-transaction-runner';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { TransactionRunnerPort } from '../../shared/persistence/transaction-runner.port';
import { AssetMetricsModule } from '../assets/asset-metrics.module';
import { AuditEngagementMetricsModule } from '../audit-engagements/audit-engagement-metrics.module';
import { ComplianceSummaryModule } from '../compliance/compliance-summary.module';
import { ControlMetricsModule } from '../controls/control-metrics.module';
import { IncidentMetricsModule } from '../incidents/incident-metrics.module';
import { ProblemMetricsModule } from '../problems/problem-metrics.module';
import { ProcessMetricsModule } from '../processes/process-metrics.module';
import { RiskDashboardMetricsModule } from '../risk/risk-dashboard-metrics.module';

import { IndicatorActionOriginAccessor } from './application/collaboration/indicator-action-origin-accessor';
import { IndicatorParentRecordAccessor } from './application/collaboration/indicator-parent-record-accessor';
import { CreateIndicatorDefinitionUseCase } from './application/create-indicator-definition.usecase';
import { CreateIndicatorMeasurementUseCase } from './application/create-indicator-measurement.usecase';
import { GetIndicatorCurrentValueUseCase } from './application/get-indicator-current-value.usecase';
import { GetIndicatorDefinitionUseCase } from './application/get-indicator-definition.usecase';
import { IndicatorCalculationService } from './application/indicator-calculation.service';
import { ListIndicatorDefinitionsUseCase } from './application/list-indicator-definitions.usecase';
import { ListIndicatorMeasurementsUseCase } from './application/list-indicator-measurements.usecase';
import { ListIndicatorMetricKeysUseCase } from './application/list-indicator-metric-keys.usecase';
import { ActionOverdueCountProvider } from './application/metric-providers/action-indicator-metric-provider';
import { AssetInactiveCountProvider } from './application/metric-providers/asset-indicator-metric-provider';
import { AuditEngagementOpenCountProvider } from './application/metric-providers/audit-engagement-indicator-metric-provider';
import { CompliancePercentageProvider } from './application/metric-providers/compliance-indicator-metric-provider';
import { ControlInactiveCountProvider } from './application/metric-providers/control-indicator-metric-provider';
import { FindingOpenCountBySeverityProvider } from './application/metric-providers/finding-indicator-metric-provider';
import { IncidentOpenCountBySeverityProvider } from './application/metric-providers/incident-indicator-metric-provider';
import { ProblemOpenCountBySeverityProvider } from './application/metric-providers/problem-indicator-metric-provider';
import { ProcessInactiveCountProvider } from './application/metric-providers/process-indicator-metric-provider';
import {
  RiskTotalByLevelProvider,
  RiskTreatmentOverdueCountProvider,
} from './application/metric-providers/risk-indicator-metric-provider';
import { UpdateIndicatorDefinitionUseCase } from './application/update-indicator-definition.usecase';
import { registerIndicatorAuditAllowlists } from './domain/indicator-audit-allowlist';
import { IndicatorDefinitionRepositoryPort } from './domain/ports/indicator-definition-repository.port';
import { IndicatorMeasurementRepositoryPort } from './domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from './domain/ports/indicator-reference-data.port';
import { PrismaIndicatorDefinitionRepository } from './infrastructure/prisma-indicator-definition.repository';
import { PrismaIndicatorMeasurementRepository } from './infrastructure/prisma-indicator-measurement.repository';
import { PrismaIndicatorReferenceDataRepository } from './infrastructure/prisma-indicator-reference-data.repository';
import { IndicatorController } from './presentation/indicator.controller';

let commentableRegistered = false;

@Module({
  imports: [
    PrismaModule,
    AuthorizationModule,
    AuditModule,
    NotificationsModule,
    OrganizationsModule,
    FindingModule,
    ActionModule,
    // Fase 3 (T019-T028) — the eight boundary-port modules the scoped
    // metric providers below depend on. Imported explicitly (see this
    // module's own header) rather than relying on `@Global()` provider
    // visibility that depended on another module having imported the
    // owning module first.
    RiskDashboardMetricsModule,
    ControlMetricsModule,
    AuditEngagementMetricsModule,
    AssetMetricsModule,
    ProcessMetricsModule,
    IncidentMetricsModule,
    ProblemMetricsModule,
    ComplianceSummaryModule,
  ],
  controllers: [IndicatorController],
  providers: [
    IndicatorParentRecordAccessor,
    // Fase 6 (T043) — `ActionOriginType.INDICATOR`'s registered accessor.
    IndicatorActionOriginAccessor,
    // Fase 3 (T018/T030/T031) — US1's three HTTP operations.
    ListIndicatorDefinitionsUseCase,
    CreateIndicatorDefinitionUseCase,
    GetIndicatorCurrentValueUseCase,
    // Fase 4 (T035/T036) — US2's two HTTP operations.
    CreateIndicatorMeasurementUseCase,
    ListIndicatorMeasurementsUseCase,
    // Fase 8 (T068) — the contract's three remaining operations.
    ListIndicatorMetricKeysUseCase,
    GetIndicatorDefinitionUseCase,
    UpdateIndicatorDefinitionUseCase,
    {
      provide: IndicatorDefinitionRepositoryPort,
      useClass: PrismaIndicatorDefinitionRepository,
    },
    {
      provide: IndicatorMeasurementRepositoryPort,
      useClass: PrismaIndicatorMeasurementRepository,
    },
    { provide: IndicatorReferenceDataPort, useClass: PrismaIndicatorReferenceDataRepository },
    { provide: EntityCodeGeneratorPort, useClass: PrismaEntityCodeGenerator },
    { provide: TransactionRunnerPort, useClass: GrcTransactionRunner },
    // Fase 3 (T019-T028) — the eleven metric providers. Deliberately
    // absent from `exports` below (see this module's own header).
    RiskTotalByLevelProvider,
    RiskTreatmentOverdueCountProvider,
    ControlInactiveCountProvider,
    AuditEngagementOpenCountProvider,
    FindingOpenCountBySeverityProvider,
    AssetInactiveCountProvider,
    ProcessInactiveCountProvider,
    ActionOverdueCountProvider,
    IncidentOpenCountBySeverityProvider,
    ProblemOpenCountBySeverityProvider,
    CompliancePercentageProvider,
    // T029 — the ONE exported consumer of the eleven providers above.
    IndicatorCalculationService,
  ],
  exports: [IndicatorDefinitionRepositoryPort, IndicatorCalculationService],
})
export class IndicatorsModule {
  constructor(
    private readonly parentRecordAccessor: IndicatorParentRecordAccessor,
    private readonly actionOriginAccessor: IndicatorActionOriginAccessor,
  ) {
    // Registers this module's own `AuditEntityType.INDICATOR`/
    // `INDICATOR_MEASUREMENT` field allow-lists (T011) from its own file,
    // without editing `core/audit/**` (ADR-011) — mirrors
    // `IncidentsModule`'s own `registerIncidentAuditAllowlists()` call.
    registerIndicatorAuditAllowlists();

    // Idempotency guard mirrors `IncidentsModule`'s own
    // `collaborationRegistered` pattern — Nest may construct this module
    // more than once across a test run's several application contexts.
    if (!commentableRegistered) {
      commentableRegistered = true;

      // CLAUDE.md §19.10 — `CommentableEntityType.INDICATOR` existed in
      // the schema (T003) with no accessor ever registered against
      // `core/comments/domain/entity-registry.ts`: a legal enum value
      // nobody wired up. This is that registration. Deliberately
      // `registerCommentableEntityType` ONLY — no
      // `registerAttachableEntityType` call exists anywhere in this
      // module (spec.md FR-033).
      registerCommentableEntityType('INDICATOR', this.parentRecordAccessor);

      // Fase 6 (T043/T045) — `ActionOriginType.INDICATOR`'s registration,
      // paired with the same migration that grows the enum
      // (`20260912000000_action_origin_type_add_indicator`, research.md
      // D-5). The SAME idempotency guard as the registration above —
      // both are one-time, process-wide registry writes, never re-run per
      // request.
      registerActionOriginResolver('INDICATOR', this.actionOriginAccessor);
    }
  }
}
