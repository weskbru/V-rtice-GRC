/**
 * 009-indicators-reports, Fase 7 (T052) — unit tests for `RunReportUseCase`.
 * Every port is a hand-rolled fake (`as unknown as <Port>`), the same
 * convention `indicator-calculation-service.spec.ts`/
 * `get-dashboard-planned-areas.spec.ts` already use.
 *
 * The central proof (FR-026/SC-006): a report with three `metricKey`s from
 * different source domains, run by a caller missing ONE of the three
 * source permissions, returns all three items — the two permitted ones
 * computed normally, the third `available: false` with no value — never a
 * thrown error that would discard the whole response.
 */
import { IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RunReportUseCase } from '../../src/modules/reports/application/run-report.usecase';
import { NotFoundDomainError } from '../../src/shared/errors/domain-error';

import type { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import type { ScopeResolverService } from '../../src/core/organizations/application/scope-resolver.service';
import type { ReportDefinitionRepositoryPort } from '../../src/modules/reports/domain/ports/report-definition-repository.port';
import type { IndicatorCalculationPort } from '../../src/shared/grc-ports/indicator-calculation.port';

const GLOBAL_SCOPE = { kind: 'GLOBAL' as const };

const REPORT = {
  id: 'report-1',
  code: 'RPT-2026-0001',
  name: 'Painel executivo',
  description: 'Três domínios',
  metricKeys: [
    IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
    IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
    IndicatorMetricKey.ASSET_INACTIVE_COUNT,
  ],
  isActive: true,
  createdByUserId: 'someone',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const CATALOG_METADATA: Record<string, { sourcePermission: string; scopeApplicability: string }> = {
  RISK_TOTAL_BY_LEVEL: { sourcePermission: 'risk:view', scopeApplicability: 'ORGANIZATIONAL_UNIT' },
  CONTROL_INACTIVE_COUNT: {
    sourcePermission: 'control:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
  ASSET_INACTIVE_COUNT: {
    sourcePermission: 'asset:view',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
  },
};

function buildUseCase(options: {
  readonly deniedPermissions?: ReadonlySet<string>;
  /** `true` simulates no report definition existing for the requested id
   * (`findById` resolves `undefined`) — distinct from simply omitting this
   * option, which uses the default `REPORT` fixture. */
  readonly reportNotFound?: boolean;
}): {
  useCase: RunReportUseCase;
  calculationPort: { calculate: ReturnType<typeof vi.fn>; getMetadata: ReturnType<typeof vi.fn> };
  scopeResolver: { resolveScope: ReturnType<typeof vi.fn> };
  permissionResolver: { hasPermission: ReturnType<typeof vi.fn> };
} {
  const denied = options.deniedPermissions ?? new Set<string>();

  const repository = {
    findById: vi.fn().mockResolvedValue(options.reportNotFound === true ? undefined : REPORT),
    list: vi.fn(),
    create: vi.fn(),
  } as unknown as ReportDefinitionRepositoryPort;

  const getMetadata = vi
    .fn()
    .mockImplementation((metricKey: string) => CATALOG_METADATA[metricKey]);
  const calculate = vi.fn().mockImplementation((input: { metricKey: string }) =>
    Promise.resolve({
      metricKey: input.metricKey,
      scopeApplicability: CATALOG_METADATA[input.metricKey]?.scopeApplicability,
      shape: 'SINGLE_VALUE',
      value: 7,
      valueByBucket: undefined,
    }),
  );
  const calculationPort = { getMetadata, calculate } as unknown as IndicatorCalculationPort;

  const resolveScope = vi.fn().mockResolvedValue(GLOBAL_SCOPE);
  const scopeResolver = { resolveScope } as unknown as ScopeResolverService;

  const hasPermission = vi
    .fn()
    .mockImplementation((_actorUserId: string, permission: string) =>
      Promise.resolve(!denied.has(permission)),
    );
  const permissionResolver = { hasPermission } as unknown as PermissionResolverService;

  const useCase = new RunReportUseCase(
    repository,
    calculationPort,
    scopeResolver,
    permissionResolver,
  );

  return {
    useCase,
    calculationPort: { calculate, getMetadata },
    scopeResolver: { resolveScope },
    permissionResolver: { hasPermission },
  };
}

describe('RunReportUseCase', () => {
  it('throws NotFoundDomainError when the report definition does not exist', async () => {
    const { useCase } = buildUseCase({ reportNotFound: true });

    await expect(
      useCase.execute({ actorUserId: 'user-1', reportId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundDomainError);
  });

  it('resolves scope exactly once regardless of how many metricKeys the report has', async () => {
    const { useCase, scopeResolver } = buildUseCase({});

    await useCase.execute({ actorUserId: 'user-1', reportId: REPORT.id });

    expect(scopeResolver.resolveScope).toHaveBeenCalledTimes(1);
  });

  it('FR-026/SC-006: a caller missing one of three source permissions gets the other two computed and the third marked available:false — never a thrown error', async () => {
    const { useCase } = buildUseCase({ deniedPermissions: new Set(['control:view']) });

    const result = await useCase.execute({ actorUserId: 'user-1', reportId: REPORT.id });

    expect(result.items).toHaveLength(3);

    const risk = result.items[0]!;
    const control = result.items[1]!;
    const asset = result.items[2]!;

    expect(risk.available).toBe(true);
    expect(risk.value).toBe(7);

    expect(control.available).toBe(false);
    expect(control.value).toBeUndefined();
    expect(control.valueByBucket).toBeUndefined();
    // FR-026 still requires scopeApplicability even for an unavailable item.
    expect(control.scopeApplicability).toBe('ORGANIZATIONAL_UNIT');

    expect(asset.available).toBe(true);
    expect(asset.value).toBe(7);
  });

  it('never calls calculate for an item whose source permission is missing', async () => {
    const { useCase, calculationPort } = buildUseCase({
      deniedPermissions: new Set(['control:view']),
    });

    await useCase.execute({ actorUserId: 'user-1', reportId: REPORT.id });

    const calculatedKeys = calculationPort.calculate.mock.calls.map(
      (call: unknown[]) => (call[0] as { metricKey: string }).metricKey,
    );
    expect(calculatedKeys).not.toContain(IndicatorMetricKey.CONTROL_INACTIVE_COUNT);
    expect(calculatedKeys).toContain(IndicatorMetricKey.RISK_TOTAL_BY_LEVEL);
    expect(calculatedKeys).toContain(IndicatorMetricKey.ASSET_INACTIVE_COUNT);
  });

  it('preserves the definition-declared metricKeys order in the result', async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute({ actorUserId: 'user-1', reportId: REPORT.id });

    expect(result.items.map((item) => item.metricKey)).toEqual(REPORT.metricKeys);
  });

  it('returns every item available when the caller has every source permission', async () => {
    const { useCase } = buildUseCase({});

    const result = await useCase.execute({ actorUserId: 'user-1', reportId: REPORT.id });

    expect(result.items.every((item) => item.available)).toBe(true);
  });
});
