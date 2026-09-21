/**
 * `GET /dashboard/summary`'s own use case — `GetDashboardSummaryUseCase`
 * (`contracts/platform.openapi.yaml`'s `getDashboardSummary` operation).
 *
 * ## Why this lives in its own business module, not `core/dashboard`
 *
 * The GRC dashboard (CLAUDE.md §11: "não como Dashboard exclusivo de
 * riscos") needs a cross-domain aggregate, but `core/**` may never import
 * `modules/**` (ADR-011, `apps/api/eslint.config.mjs` rule 3) — the same
 * constraint `modules/risk/presentation/dashboard.controller.ts`'s own
 * header already documents for why `GET /dashboard` stays on
 * `modules/risk` rather than moving to `core/dashboard`. This use case
 * needs `IndicatorCalculationPort`, a `shared/grc-ports/**` boundary port
 * — `shared/**` is reachable from anywhere, but the CONSUMING code (this
 * file) still has to live under some `modules/(module)/**` for the
 * module-isolation lint rule to classify it at all, so a new, minimal
 * business module (`modules/dashboard`) is the only legal home. `GET
 * /dashboard` itself (the Risk-backed areas) is untouched — this is an
 * ADDITIONAL endpoint, not a replacement.
 *
 * ## Reused, never recomputed (CLAUDE.md §19.7, §19.8)
 *
 * Every metric here is computed by `IndicatorCalculationService`, the
 * platform's single calculator, reached through the exact same boundary
 * port `modules/reports/application/run-report.usecase.ts` already
 * consumes (`shared/grc-ports/indicator-calculation.port.ts`) — this use
 * case introduces no second calculation, no second catalog, no second
 * count of any of the eleven `IndicatorMetricKey`s.
 *
 * ## Omitted, never zeroed — the one place this differs from
 * ## `GetDashboardUseCase` and from `RunReportUseCase`
 *
 * `GetDashboardUseCase` (`modules/risk`) ZEROES a risk area the caller
 * cannot see. `RunReportUseCase` marks an item `available: false` because
 * a report's `metricKeys` are a caller-authored list that must echo back
 * one entry per configured key. Neither shape fits here: this endpoint's
 * catalog is not caller-configured, it is the platform's own closed set,
 * so there is no reason to return an entry that carries no information at
 * all. A metric key whose `sourcePermission` (`getMetadata`, a static
 * catalog lookup, no I/O — safe to call before deciding whether to
 * `calculate` at all) the caller does not hold is filtered out BEFORE
 * `calculate` is ever invoked for it — never computed, never returned as
 * a zero, never returned with an `available: false` flag either. A
 * zero-permission caller's `metrics` array is therefore genuinely `[]`,
 * and the response is still a genuine `200` (the endpoint itself requires
 * only an authenticated session, `DashboardSummaryController`'s own
 * `@NoPermissionRequired()` — the identical shape `GetDashboardUseCase`'s
 * own header documents for `GET /dashboard`).
 *
 * ## Scope and permissions, each resolved exactly once (ADR-004, FR-028)
 *
 * `ScopeResolverService.resolveScope` and
 * `PermissionResolverService.getEffectivePermissions` are each called
 * ONCE per request and their results forwarded to every metric —
 * `GetDashboardUseCase`'s own pattern, applied here across the full
 * eleven-key catalog instead of Risk Management's five permission-gated
 * areas.
 *
 * ## `breakdowns` — real model data the closed eleven-key catalog does not
 * ## carry, added alongside `metrics` rather than inside it
 *
 * `metrics` stays the closed `IndicatorMetricKey` catalog exactly as
 * before — untouched by this addition. `breakdowns` is a SEPARATE object
 * of six independently-gated blocks (`actions`, `incidents`, `problems`,
 * `controls`, `compliance`, `indicators`), each keyed to its own
 * source-domain `*:view` permission and OMITTED ENTIRELY (never zeroed,
 * mirroring `metrics`' own "omitted, never zeroed" discipline above) when
 * the caller lacks it. Every number inside a present block is computed by
 * the SAME single source each domain's own metric provider/adapter already
 * uses — never a second rule (CLAUDE.md §19.7):
 *
 *   - `actions` — `ActionRepositoryPort` (`grc/action`, a GRC-kernel
 *     capability this module may depend on directly, ADR-016 — the same
 *     choice `ActionOverdueCountProvider` already makes, no
 *     `shared/grc-ports` boundary port needed).
 *   - `incidents`/`problems`/`controls` — the SAME `*MetricsPort`
 *     boundary ports (`shared/grc-ports/**`) `IndicatorsModule`'s own
 *     metric providers already depend on.
 *   - `compliance` — the SAME `ComplianceSummaryPort` the
 *     `COMPLIANCE_PERCENTAGE` provider depends on, now exposing the
 *     per-state distribution alongside the percentage (one calculator,
 *     two views — see `OrganizationComplianceSummaryAdapter`'s own
 *     header).
 *   - `indicators` — a NEW boundary port, `IndicatorMonitoringPort`
 *     (`shared/grc-ports/indicator-monitoring.port.ts`), answering a
 *     question no existing `IndicatorMetricKey` asks (how many
 *     definitions are monitored/breached, not the value of one).
 */
import { Injectable } from '@nestjs/common';
// Every key in the closed catalog, read directly off the generated Prisma
// enum (a value import, not a type-only one — the same choice
// `run-report.usecase.spec.ts`'s own fixtures already make for the
// identical enum) rather than a second, hand-written list. `@prisma/client`
// is a generated platform-wide artifact, not `modules/indicators/**`
// itself, so importing its enum VALUE here does not cross the
// module-isolation boundary this file's own header explains this module
// must respect (`modules/dashboard` never imports `modules/indicators/**`
// directly — only the shared port, which forwards `IndicatorMetricKey` as
// a plain type parameter).
import { IndicatorMetricKey } from '@prisma/client';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
// `Action` is a GRC-kernel capability (`grc/action`, ADR-016) —
// `modules/dashboard` is explicitly allowed to depend on `grc-domain`
// directly, the same way `modules/indicators`'s own
// `ActionOverdueCountProvider` already does (that file's own header). No
// `shared/grc-ports` boundary port is needed for this one.
import { ActionRepositoryPort } from '../../../grc/action/domain/ports/action-repository.port';
import { todayDateOnlyUtc } from '../../../grc/shared/domain/overdue.service';
import { ComplianceSummaryPort } from '../../../shared/grc-ports/compliance-summary.port';
import { ControlMetricsPort } from '../../../shared/grc-ports/control-metrics.port';
import { IncidentMetricsPort } from '../../../shared/grc-ports/incident-metrics.port';
import { IndicatorCalculationPort } from '../../../shared/grc-ports/indicator-calculation.port';
import { IndicatorMonitoringPort } from '../../../shared/grc-ports/indicator-monitoring.port';
import { ProblemMetricsPort } from '../../../shared/grc-ports/problem-metrics.port';

import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type {
  IndicatorMetricScopeApplicability,
  IndicatorMetricShape,
} from '../../../shared/grc-ports/indicator-calculation.port';
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type {
  ActionStatus,
  IncidentStatus,
  ProblemStatus,
  RequirementComplianceState,
} from '@prisma/client';

const ALL_METRIC_KEYS: readonly IndicatorMetricKey[] = Object.values(IndicatorMetricKey);

/** `breakdowns.actions.dueSoonWindowDays` — fixed, never caller-configured
 * (there is no query parameter on this operation at all). Exported so the
 * unit test can assert against the SAME constant this use case computes
 * `dueSoonRangeEnd` from, rather than a hand-typed literal `7`. */
export const ACTION_DUE_SOON_WINDOW_DAYS = 7;

export interface DashboardSummaryMetricOutput {
  readonly metricKey: IndicatorMetricKey;
  readonly shape: IndicatorMetricShape;
  readonly scopeApplicability: IndicatorMetricScopeApplicability;
  /** Populated only when `shape === 'SINGLE_VALUE'` — `undefined`, never
   * `0`, when the source domain has no data yet (mirrors
   * `IndicatorCalculationPortResult.value`'s own "nunca 0 nem 100" edge
   * case, this file's own header). */
  readonly value: number | undefined;
  /** Populated only when `shape === 'BY_BUCKET'`. */
  readonly valueByBucket: Readonly<Record<string, number>> | undefined;
}

export interface DashboardSummaryActionsBreakdown {
  readonly byStatus: Readonly<Record<ActionStatus, number>>;
  readonly dueSoon: number;
  readonly dueSoonWindowDays: number;
}

export interface DashboardSummaryIncidentsBreakdown {
  readonly byStatus: Readonly<Record<IncidentStatus, number>>;
}

export interface DashboardSummaryProblemsBreakdown {
  readonly byStatus: Readonly<Record<ProblemStatus, number>>;
}

export interface DashboardSummaryControlsBreakdown {
  readonly total: number;
  readonly active: number;
  readonly ineffective: number;
}

export interface DashboardSummaryComplianceBreakdown {
  readonly requirementCount: number;
  readonly byState: Readonly<Record<RequirementComplianceState, number>>;
}

export interface DashboardSummaryIndicatorsBreakdown {
  readonly monitored: number;
  readonly breached: number;
}

/** Every property `undefined` — never present-but-empty — when the caller
 * lacks that block's own source permission (mirrors `metrics`' own
 * "omitted, never zeroed" discipline, this file's own header). */
export interface DashboardSummaryBreakdownsOutput {
  readonly actions: DashboardSummaryActionsBreakdown | undefined;
  readonly incidents: DashboardSummaryIncidentsBreakdown | undefined;
  readonly problems: DashboardSummaryProblemsBreakdown | undefined;
  readonly controls: DashboardSummaryControlsBreakdown | undefined;
  readonly compliance: DashboardSummaryComplianceBreakdown | undefined;
  readonly indicators: DashboardSummaryIndicatorsBreakdown | undefined;
}

export interface DashboardSummaryOutput {
  readonly metrics: readonly DashboardSummaryMetricOutput[];
  readonly breakdowns: DashboardSummaryBreakdownsOutput;
}

export interface GetDashboardSummaryInput {
  readonly actorUserId: string;
}

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    private readonly indicatorCalculation: IndicatorCalculationPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly incidentMetrics: IncidentMetricsPort,
    private readonly problemMetrics: ProblemMetricsPort,
    private readonly controlMetrics: ControlMetricsPort,
    private readonly complianceSummary: ComplianceSummaryPort,
    private readonly indicatorMonitoring: IndicatorMonitoringPort,
  ) {}

  async execute(input: GetDashboardSummaryInput): Promise<DashboardSummaryOutput> {
    const [scope, permissions] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.permissionResolver.getEffectivePermissions(input.actorUserId),
    ]);

    // Filtering happens BEFORE any `calculate` call — a metric the caller
    // cannot see is never computed, matching this file's own header
    // ("omitted, never zeroed"). `getMetadata` is a pure catalog lookup
    // (no I/O), so this filter is cheap even though every one of the
    // eleven keys is checked on every request.
    const permittedKeys = ALL_METRIC_KEYS.filter((metricKey) => {
      const { sourcePermission } = this.indicatorCalculation.getMetadata(metricKey);
      // See `IndicatorCalculationPort`'s own header for why the port
      // returns `sourcePermission` as `string` and this call site narrows
      // it back — the value always originates from
      // `INDICATOR_METRIC_CATALOG`, itself typed `PermissionIdentifier`
      // (the identical narrowing `RunReportUseCase` performs at its own
      // call site).
      return permissions.has(sourcePermission as PermissionIdentifier);
    });

    const [results, breakdowns] = await Promise.all([
      Promise.all(
        permittedKeys.map((metricKey) => this.indicatorCalculation.calculate({ metricKey, scope })),
      ),
      this.buildBreakdowns(scope, permissions),
    ]);

    return {
      metrics: results.map((result) => ({
        metricKey: result.metricKey,
        shape: result.shape,
        scopeApplicability: result.scopeApplicability,
        value: result.value,
        valueByBucket: result.valueByBucket,
      })),
      breakdowns,
    };
  }

  /**
   * The six `breakdowns` blocks, each gated on its own source-domain
   * `*:view` permission and computed in parallel — the same "resolve
   * once, forward everywhere" scope discipline `execute` already applies
   * to `metrics` (this file's own header, ADR-004).
   */
  private async buildBreakdowns(
    scope: ScopeFilter,
    permissions: ReadonlySet<PermissionIdentifier>,
  ): Promise<DashboardSummaryBreakdownsOutput> {
    const [actions, incidents, problems, controls, compliance, indicators] = await Promise.all([
      permissions.has('action:view')
        ? this.buildActionsBreakdown(scope)
        : Promise.resolve(undefined),
      permissions.has('incident:view')
        ? this.incidentMetrics
            .getCountByStatus(scope)
            .then((byStatus): DashboardSummaryIncidentsBreakdown => ({ byStatus }))
        : Promise.resolve(undefined),
      permissions.has('problem:view')
        ? this.problemMetrics
            .getCountByStatus(scope)
            .then((byStatus): DashboardSummaryProblemsBreakdown => ({ byStatus }))
        : Promise.resolve(undefined),
      permissions.has('control:view')
        ? this.controlMetrics.getSummary(scope)
        : Promise.resolve(undefined),
      permissions.has('compliance:view')
        ? this.complianceSummary.getStateBreakdown()
        : Promise.resolve(undefined),
      permissions.has('indicator:view')
        ? this.indicatorMonitoring.getMonitoringSummary()
        : Promise.resolve(undefined),
    ]);

    return { actions, incidents, problems, controls, compliance, indicators };
  }

  /** `breakdowns.actions` — status breakdown plus the "due soon" window,
   * both scoped by `Action.orgUnitId` (`ActionRepositoryPort`'s own
   * doc comments). `todayDateOnlyUtc()` is the SAME "today" every other
   * overdue/due-soon check in the platform reads from (`grc/shared/domain/
   * overdue.service.ts`) — never a second clock read. */
  private async buildActionsBreakdown(
    scope: ScopeFilter,
  ): Promise<DashboardSummaryActionsBreakdown> {
    const fromInclusive = todayDateOnlyUtc();
    const toExclusive = new Date(fromInclusive);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + ACTION_DUE_SOON_WINDOW_DAYS);

    const [byStatus, dueSoon] = await Promise.all([
      this.actionRepository.getStatusBreakdown(scope),
      this.actionRepository.countDueSoonInScope(scope, fromInclusive, toExclusive),
    ]);

    return { byStatus, dueSoon, dueSoonWindowDays: ACTION_DUE_SOON_WINDOW_DAYS };
  }
}
