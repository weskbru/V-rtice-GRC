/**
 * Unit tests for `GetDashboardSummaryUseCase`
 * (`apps/api/src/modules/dashboard/application/get-dashboard-summary.usecase.ts`).
 * `IndicatorCalculationPort`/`ScopeResolverService`/`PermissionResolverService`
 * are hand-rolled fakes (`as unknown as <Port>`), the same convention
 * `run-report.usecase.spec.ts` already uses for the identical port.
 *
 * The central proof this file exists for: a metric key whose source
 * permission the caller lacks is OMITTED from the result — never present
 * with a zeroed value, never present with an `available: false` flag,
 * never even passed to `calculate`. This is deliberately a DIFFERENT
 * contract from `RunReportUseCase`'s own `available: false` shape — see
 * the use case's own header for why. `IndicatorMetricKey` is read directly
 * off the generated Prisma enum (`Object.values`), matching the use case's
 * own enumeration, so this test suite is not a second, hand-written key
 * list that could silently drift from the real eleven-key catalog.
 */
import { IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { GetDashboardSummaryUseCase } from '../../src/modules/dashboard/application/get-dashboard-summary.usecase';

import type { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { ScopeResolverService } from '../../src/core/organizations/application/scope-resolver.service';
import type { ActionRepositoryPort } from '../../src/grc/action/domain/ports/action-repository.port';
import type { ComplianceSummaryPort } from '../../src/shared/grc-ports/compliance-summary.port';
import type { ControlMetricsPort } from '../../src/shared/grc-ports/control-metrics.port';
import type { IncidentMetricsPort } from '../../src/shared/grc-ports/incident-metrics.port';
import type { IndicatorCalculationPort } from '../../src/shared/grc-ports/indicator-calculation.port';
import type { IndicatorMonitoringPort } from '../../src/shared/grc-ports/indicator-monitoring.port';
import type { ProblemMetricsPort } from '../../src/shared/grc-ports/problem-metrics.port';

const ALL_KEYS = Object.values(IndicatorMetricKey);

const GLOBAL_SCOPE = { kind: 'GLOBAL' as const };

/** The six `breakdowns` block permissions — a DIFFERENT axis from
 * `ALL_KEYS`' own fake `metrics` permissions above; real, catalogued
 * identifiers (`action:view` etc.), never `fake:*` strings, because the use
 * case checks these literal strings directly (`get-dashboard-summary
 * .usecase.ts`'s own `buildBreakdowns`). */
const ALL_BREAKDOWN_PERMISSIONS: readonly PermissionIdentifier[] = [
  'action:view',
  'incident:view',
  'problem:view',
  'control:view',
  'compliance:view',
  'indicator:view',
] as const;

const FAKE_ACTIONS_BREAKDOWN = {
  byStatus: { OPEN: 1, IN_PROGRESS: 2, COMPLETED: 3, CANCELLED: 4 },
  dueSoon: 5,
  dueSoonWindowDays: 7,
};
const FAKE_INCIDENTS_BY_STATUS = {
  OPEN: 1,
  IN_PROGRESS: 1,
  RESOLVED: 1,
  CLOSED: 1,
  CANCELLED: 1,
};
const FAKE_PROBLEMS_BY_STATUS = {
  OPEN: 1,
  IN_ANALYSIS: 1,
  RESOLVED: 1,
  CLOSED: 1,
  CANCELLED: 1,
};
const FAKE_CONTROLS_BREAKDOWN = { total: 10, active: 8, ineffective: 2 };
const FAKE_COMPLIANCE_BREAKDOWN = {
  requirementCount: 5,
  byState: { NOT_APPLICABLE: 1, NOT_MET: 1, NOT_PROVEN: 1, PARTIALLY_MET: 1, COMPLIANT: 1 },
};
const FAKE_INDICATORS_BREAKDOWN = { monitored: 3, breached: 1 };

/** One fake source permission per real catalog key — the exact string
 * never needs to match production's `INDICATOR_METRIC_CATALOG` (this test
 * verifies the USE CASE's own filtering logic against whatever
 * `getMetadata` reports, not the real catalog's own content, which
 * `indicator-metric-catalog.spec.ts` already covers exhaustively). */
function fakeSourcePermission(metricKey: IndicatorMetricKey): string {
  return `fake:${metricKey}`;
}

function buildUseCase(options: {
  readonly deniedKeys?: ReadonlySet<IndicatorMetricKey>;
  readonly valueByKey?: Readonly<Record<string, number | undefined>>;
  /** Breakdown permissions to WITHHOLD — every other one of the six is
   * granted by default, mirroring `deniedKeys`' own "everything granted
   * unless named" convention above. */
  readonly deniedBreakdownPermissions?: ReadonlySet<PermissionIdentifier>;
}): {
  useCase: GetDashboardSummaryUseCase;
  calculationPort: { calculate: ReturnType<typeof vi.fn>; getMetadata: ReturnType<typeof vi.fn> };
  scopeResolver: { resolveScope: ReturnType<typeof vi.fn> };
  permissionResolver: { getEffectivePermissions: ReturnType<typeof vi.fn> };
  actionRepository: {
    getStatusBreakdown: ReturnType<typeof vi.fn>;
    countDueSoonInScope: ReturnType<typeof vi.fn>;
  };
  incidentMetrics: { getCountByStatus: ReturnType<typeof vi.fn> };
  problemMetrics: { getCountByStatus: ReturnType<typeof vi.fn> };
  controlMetrics: { getSummary: ReturnType<typeof vi.fn> };
  complianceSummary: { getStateBreakdown: ReturnType<typeof vi.fn> };
  indicatorMonitoring: { getMonitoringSummary: ReturnType<typeof vi.fn> };
} {
  const denied = options.deniedKeys ?? new Set<IndicatorMetricKey>();
  const deniedBreakdown = options.deniedBreakdownPermissions ?? new Set<PermissionIdentifier>();

  const getMetadata = vi.fn().mockImplementation((metricKey: IndicatorMetricKey) => ({
    sourcePermission: fakeSourcePermission(metricKey),
    scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
  }));
  const valueByKey = options.valueByKey ?? {};
  const calculate = vi.fn().mockImplementation((input: { metricKey: IndicatorMetricKey }) => {
    // `??` cannot be used here: it treats an explicitly-configured
    // `undefined` value the same as "not configured", which is exactly the
    // distinction this fixture needs to preserve for the "no data yet"
    // test below.
    const value = Object.prototype.hasOwnProperty.call(valueByKey, input.metricKey)
      ? valueByKey[input.metricKey]
      : 3;
    return Promise.resolve({
      metricKey: input.metricKey,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      shape: 'SINGLE_VALUE' as const,
      value,
      valueByBucket: undefined,
    });
  });
  const calculationPort = { getMetadata, calculate } as unknown as IndicatorCalculationPort;

  const resolveScope = vi.fn().mockResolvedValue(GLOBAL_SCOPE);
  const scopeResolver = { resolveScope } as unknown as ScopeResolverService;

  const grantedPermissions = new Set<PermissionIdentifier>([
    ...ALL_KEYS.filter((key) => !denied.has(key)).map(
      (key) => fakeSourcePermission(key) as PermissionIdentifier,
    ),
    ...ALL_BREAKDOWN_PERMISSIONS.filter((permission) => !deniedBreakdown.has(permission)),
  ]);
  const getEffectivePermissions = vi.fn().mockResolvedValue(grantedPermissions);
  const permissionResolver = { getEffectivePermissions } as unknown as PermissionResolverService;

  const getStatusBreakdown = vi.fn().mockResolvedValue(FAKE_ACTIONS_BREAKDOWN.byStatus);
  const countDueSoonInScope = vi.fn().mockResolvedValue(FAKE_ACTIONS_BREAKDOWN.dueSoon);
  const actionRepository = {
    getStatusBreakdown,
    countDueSoonInScope,
  } as unknown as ActionRepositoryPort;

  const incidentGetCountByStatus = vi.fn().mockResolvedValue(FAKE_INCIDENTS_BY_STATUS);
  const incidentMetrics = {
    getCountByStatus: incidentGetCountByStatus,
  } as unknown as IncidentMetricsPort;

  const problemGetCountByStatus = vi.fn().mockResolvedValue(FAKE_PROBLEMS_BY_STATUS);
  const problemMetrics = {
    getCountByStatus: problemGetCountByStatus,
  } as unknown as ProblemMetricsPort;

  const controlGetSummary = vi.fn().mockResolvedValue(FAKE_CONTROLS_BREAKDOWN);
  const controlMetrics = { getSummary: controlGetSummary } as unknown as ControlMetricsPort;

  const complianceGetStateBreakdown = vi.fn().mockResolvedValue(FAKE_COMPLIANCE_BREAKDOWN);
  const complianceSummary = {
    getStateBreakdown: complianceGetStateBreakdown,
  } as unknown as ComplianceSummaryPort;

  const indicatorGetMonitoringSummary = vi.fn().mockResolvedValue(FAKE_INDICATORS_BREAKDOWN);
  const indicatorMonitoring = {
    getMonitoringSummary: indicatorGetMonitoringSummary,
  } as unknown as IndicatorMonitoringPort;

  const useCase = new GetDashboardSummaryUseCase(
    calculationPort,
    scopeResolver,
    permissionResolver,
    actionRepository,
    incidentMetrics,
    problemMetrics,
    controlMetrics,
    complianceSummary,
    indicatorMonitoring,
  );

  return {
    useCase,
    calculationPort: { calculate, getMetadata },
    scopeResolver: { resolveScope },
    permissionResolver: { getEffectivePermissions },
    actionRepository: { getStatusBreakdown, countDueSoonInScope },
    incidentMetrics: { getCountByStatus: incidentGetCountByStatus },
    problemMetrics: { getCountByStatus: problemGetCountByStatus },
    controlMetrics: { getSummary: controlGetSummary },
    complianceSummary: { getStateBreakdown: complianceGetStateBreakdown },
    indicatorMonitoring: { getMonitoringSummary: indicatorGetMonitoringSummary },
  };
}

describe('GetDashboardSummaryUseCase', () => {
  it('resolves scope and reads effective permissions exactly once per request', async () => {
    const { useCase, scopeResolver, permissionResolver } = buildUseCase({});

    await useCase.execute({ actorUserId: 'user-1' });

    expect(scopeResolver.resolveScope).toHaveBeenCalledTimes(1);
    expect(permissionResolver.getEffectivePermissions).toHaveBeenCalledTimes(1);
  });

  it('returns every one of the eleven catalog keys when the caller holds every source permission', async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute({ actorUserId: 'user-1' });

    expect(result.metrics).toHaveLength(ALL_KEYS.length);
    expect(new Set(result.metrics.map((metric) => metric.metricKey))).toEqual(new Set(ALL_KEYS));
  });

  it('returns an empty array — never a thrown error — for a caller holding none of the source permissions', async () => {
    const { useCase, calculationPort } = buildUseCase({ deniedKeys: new Set(ALL_KEYS) });

    const result = await useCase.execute({ actorUserId: 'user-1' });

    expect(result.metrics).toEqual([]);
    expect(calculationPort.calculate).not.toHaveBeenCalled();
  });

  it('OMITS the one key whose source permission is missing — never present with available:false, never present zeroed', async () => {
    const { useCase, calculationPort } = buildUseCase({
      deniedKeys: new Set([IndicatorMetricKey.CONTROL_INACTIVE_COUNT]),
    });

    const result = await useCase.execute({ actorUserId: 'user-1' });

    expect(result.metrics).toHaveLength(ALL_KEYS.length - 1);
    expect(
      result.metrics.some(
        (metric) => metric.metricKey === IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
      ),
    ).toBe(false);

    // Never even computed — the omitted key's permission gate runs BEFORE
    // any call to `calculate`, matching the use case's own header ("omitted,
    // never zeroed").
    const calculatedKeys = calculationPort.calculate.mock.calls.map(
      (call: unknown[]) => (call[0] as { metricKey: IndicatorMetricKey }).metricKey,
    );
    expect(calculatedKeys).not.toContain(IndicatorMetricKey.CONTROL_INACTIVE_COUNT);
    expect(calculatedKeys).toHaveLength(ALL_KEYS.length - 1);
  });

  it('the SAME key appears when the caller DOES hold its source permission — distinguishing "omitted by permission" from "omitted by lack of data"', async () => {
    const withoutControl = await buildUseCase({
      deniedKeys: new Set([IndicatorMetricKey.CONTROL_INACTIVE_COUNT]),
    }).useCase.execute({ actorUserId: 'user-1' });
    const withControl = await buildUseCase({}).useCase.execute({ actorUserId: 'user-1' });

    expect(
      withoutControl.metrics.some((m) => m.metricKey === IndicatorMetricKey.CONTROL_INACTIVE_COUNT),
    ).toBe(false);
    expect(
      withControl.metrics.some((m) => m.metricKey === IndicatorMetricKey.CONTROL_INACTIVE_COUNT),
    ).toBe(true);
  });

  it('forwards the resolved scope, unchanged, to every permitted calculate call', async () => {
    const { useCase, calculationPort } = buildUseCase({});

    await useCase.execute({ actorUserId: 'user-1' });

    for (const call of calculationPort.calculate.mock.calls as unknown[][]) {
      expect((call[0] as { scope: unknown }).scope).toBe(GLOBAL_SCOPE);
    }
  });

  it('preserves value: undefined — never converts it to 0 — when the source domain has no data yet', async () => {
    const { useCase } = buildUseCase({
      valueByKey: { [IndicatorMetricKey.RISK_TREATMENT_OVERDUE_COUNT]: undefined },
    });

    const result = await useCase.execute({ actorUserId: 'user-1' });

    const item = result.metrics.find(
      (metric) => metric.metricKey === IndicatorMetricKey.RISK_TREATMENT_OVERDUE_COUNT,
    );
    expect(item).toBeDefined();
    expect(item!.value).toBeUndefined();
    expect(item!.value === 0).toBe(false);
  });
});

describe('GetDashboardSummaryUseCase — breakdowns', () => {
  it('includes every one of the six blocks when the caller holds every breakdown permission, each with the shape its own port returned', async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute({ actorUserId: 'user-1' });

    expect(result.breakdowns.actions).toEqual(FAKE_ACTIONS_BREAKDOWN);
    expect(result.breakdowns.incidents).toEqual({ byStatus: FAKE_INCIDENTS_BY_STATUS });
    expect(result.breakdowns.problems).toEqual({ byStatus: FAKE_PROBLEMS_BY_STATUS });
    expect(result.breakdowns.controls).toEqual(FAKE_CONTROLS_BREAKDOWN);
    expect(result.breakdowns.compliance).toEqual(FAKE_COMPLIANCE_BREAKDOWN);
    expect(result.breakdowns.indicators).toEqual(FAKE_INDICATORS_BREAKDOWN);
  });

  it('returns breakdowns as a genuine {} — no key at all — for a caller holding none of the six breakdown permissions, never a 403 and never a zeroed block', async () => {
    const { useCase, actionRepository, complianceSummary } = buildUseCase({
      deniedBreakdownPermissions: new Set(ALL_BREAKDOWN_PERMISSIONS),
    });

    const result = await useCase.execute({ actorUserId: 'user-1' });

    expect(result.breakdowns).toEqual({
      actions: undefined,
      incidents: undefined,
      problems: undefined,
      controls: undefined,
      compliance: undefined,
      indicators: undefined,
    });
    // Never even computed — the same "omitted, never zeroed" discipline
    // `metrics` itself follows (this file's own header, the use case's own
    // header).
    expect(actionRepository.getStatusBreakdown).not.toHaveBeenCalled();
    expect(complianceSummary.getStateBreakdown).not.toHaveBeenCalled();
  });

  it.each([
    ['action:view' as const, 'actions'] as const,
    ['incident:view' as const, 'incidents'] as const,
    ['problem:view' as const, 'problems'] as const,
    ['control:view' as const, 'controls'] as const,
    ['compliance:view' as const, 'compliance'] as const,
    ['indicator:view' as const, 'indicators'] as const,
  ])(
    "OMITS only %s's own block (%s) when that ONE permission is withheld — every other block still present",
    async (permission, blockKey) => {
      const { useCase } = buildUseCase({
        deniedBreakdownPermissions: new Set([permission]),
      });

      const result = await useCase.execute({ actorUserId: 'user-1' });

      expect(result.breakdowns[blockKey]).toBeUndefined();
      for (const otherKey of Object.keys(result.breakdowns) as (keyof typeof result.breakdowns)[]) {
        if (otherKey === blockKey) continue;
        expect(result.breakdowns[otherKey]).toBeDefined();
      }
    },
  );

  it('the SAME block reappears once the withheld permission is granted — distinguishing "omitted by permission" from "omitted by lack of data"', async () => {
    const withoutControlView = await buildUseCase({
      deniedBreakdownPermissions: new Set(['control:view']),
    }).useCase.execute({ actorUserId: 'user-1' });
    const withControlView = await buildUseCase({}).useCase.execute({ actorUserId: 'user-1' });

    expect(withoutControlView.breakdowns.controls).toBeUndefined();
    expect(withControlView.breakdowns.controls).toEqual(FAKE_CONTROLS_BREAKDOWN);
  });

  it('computes breakdowns.actions.dueSoon over a [today, today + 7 days) window, forwarding the SAME scope every metric call receives', async () => {
    const { useCase, actionRepository } = buildUseCase({});

    await useCase.execute({ actorUserId: 'user-1' });

    expect(actionRepository.getStatusBreakdown).toHaveBeenCalledWith(GLOBAL_SCOPE);
    expect(actionRepository.countDueSoonInScope).toHaveBeenCalledTimes(1);
    const [scopeArg, fromInclusive, toExclusive] = actionRepository.countDueSoonInScope.mock
      .calls[0] as [unknown, Date, Date];
    expect(scopeArg).toBe(GLOBAL_SCOPE);
    const days = (toExclusive.getTime() - fromInclusive.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(7);
  });

  it('resolves compliance and indicators — the two organization-wide blocks — with no scope argument at all', async () => {
    const { useCase, complianceSummary, indicatorMonitoring } = buildUseCase({});

    await useCase.execute({ actorUserId: 'user-1' });

    expect(complianceSummary.getStateBreakdown).toHaveBeenCalledWith();
    expect(indicatorMonitoring.getMonitoringSummary).toHaveBeenCalledWith();
  });
});
