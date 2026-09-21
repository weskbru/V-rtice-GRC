/**
 * 009-indicators-reports, Fase 7 (T055) — SC-006, read from the real
 * database rather than through HTTP (`test/contract/reports.spec.ts`'s own
 * "SC-006" test already proves the HTTP-level `200` + shape; this file
 * proves the same rule at the application layer, against real seeded
 * domain data, mirroring `indicator-current-value-organizational-scope
 * .spec.ts`'s own "call the use case directly against a real Nest testing
 * module" convention).
 *
 * A `ReportDefinition` referencing three `IndicatorMetricKey` values from
 * three different source domains (Risk, Asset, Control), executed by a
 * caller holding `risk:view`/`asset:view` but NOT `control:view` — the
 * third metric's own `sourcePermission` (`indicator-metric-catalog.ts`).
 * `RunReportUseCase.execute` must return all three items, never throw:
 * the two permitted items computed with real, non-trivial values (seeded
 * below, not zero by accident), and the third `available: false` with
 * neither `value` nor `valueByBucket` populated (spec.md FR-026, SC-006).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateReportDefinitionUseCase } from '../../src/modules/reports/application/create-report-definition.usecase';
import { RunReportUseCase } from '../../src/modules/reports/application/run-report.usecase';
import { ReportsModule } from '../../src/modules/reports/reports.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('RunReportUseCase — partial source-permission integration (SC-006, T055)', () => {
  let ctx: IntegrationTestContext;
  let createUseCase: CreateReportDefinitionUseCase;
  let runUseCase: RunReportUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, ReportsModule],
    });
    createUseCase = ctx.app.get(CreateReportDefinitionUseCase);
    runUseCase = ctx.app.get(RunReportUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('two of three metrics compute with real values, the one lacking source permission is available:false, no exception thrown', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('report-partial-permission'),
    });

    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('report-partial-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      // Deliberately NOT `control:view` — CONTROL_INACTIVE_COUNT's own
      // `sourcePermission` (data-model.md §3), the third metric below.
      ['report:create', 'report:view', 'risk:view', 'asset:view'],
      { name: uniqueTestMarker('fixture-report-partial-role') },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    // Real, non-zero seed data for the two permitted metrics — a report
    // that only ever saw zeros would never distinguish "computed" from
    // "silently defaulted".
    await ctx.prisma.client.risk.create({
      data: {
        code: uniqueTestMarker('risk-partial'),
        title: 'Risco para paridade de permissão parcial',
        description: 'Descrição.',
        orgUnitId: orgUnit.id,
        ownerUserId: actor.id,
        identifiedOn: new Date('2026-01-01'),
        residualLevel: 'HIGH',
      },
    });
    await ctx.prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('asset-partial'),
        name: 'Ativo para paridade de permissão parcial',
        orgUnitId: orgUnit.id,
        isActive: false,
      },
    });
    // Real data for the THIRD (forbidden) metric too — proves there is
    // something real to withhold, not an accidentally-empty count.
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control-partial'),
        name: 'Controle para paridade de permissão parcial',
        orgUnitId: orgUnit.id,
        status: 'DRAFT',
      },
    });

    const created = await createUseCase.execute({
      actorUserId: actor.id,
      name: 'Relatório de paridade de permissão parcial',
      description: 'Descrição.',
      metricKeys: ['RISK_TOTAL_BY_LEVEL', 'ASSET_INACTIVE_COUNT', 'CONTROL_INACTIVE_COUNT'],
    });

    const result = await runUseCase.execute({
      actorUserId: actor.id,
      reportId: created.record.id,
    });

    expect(result.items).toHaveLength(3);
    const byKey = new Map(result.items.map((item) => [item.metricKey, item]));

    const riskItem = byKey.get('RISK_TOTAL_BY_LEVEL')!;
    expect(riskItem.available).toBe(true);
    expect(riskItem.valueByBucket).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 1, CRITICAL: 0 });
    expect(riskItem.value).toBeUndefined();

    const assetItem = byKey.get('ASSET_INACTIVE_COUNT')!;
    expect(assetItem.available).toBe(true);
    expect(assetItem.value).toBe(1);

    const controlItem = byKey.get('CONTROL_INACTIVE_COUNT')!;
    expect(controlItem.available).toBe(false);
    expect(controlItem.value).toBeUndefined();
    expect(controlItem.valueByBucket).toBeUndefined();
  });
});
