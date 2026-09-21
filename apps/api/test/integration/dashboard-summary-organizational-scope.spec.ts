/**
 * `GetDashboardSummaryUseCase` — organizational-scope proof, against a
 * real Postgres database, never a mocked `IndicatorCalculationPort`.
 * Mirrors `report-run-organizational-scope.spec.ts`'s own convention
 * (`RunReportUseCase`'s identical proof for `IndicatorCalculationPort`),
 * applied here to the dashboard summary's own use case.
 *
 * `CONTROL_INACTIVE_COUNT` (`ORGANIZATIONAL_UNIT` scope applicability,
 * `INDICATOR_METRIC_CATALOG`) is the metric under test: a caller scoped to
 * ONE organizational unit only sees that unit's own non-ACTIVE controls, a
 * caller holding a GLOBAL scope grant sees every non-ACTIVE control in the
 * database. Two controls are created in the narrow caller's own unit and
 * one more in a SECOND unit the narrow caller has no grant for — the
 * broad caller's total is therefore guaranteed strictly greater than the
 * narrow caller's own count (>= 3 vs exactly 2), never both counting the
 * same total, which would pass even with the scope filter deleted.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { GetDashboardSummaryUseCase } from '../../src/modules/dashboard/application/get-dashboard-summary.usecase';
import { DashboardSummaryModule } from '../../src/modules/dashboard/dashboard-summary.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

describe('GetDashboardSummaryUseCase — organizational-scope parity between a narrow and a broad caller', () => {
  let ctx: IntegrationTestContext;
  let useCase: GetDashboardSummaryUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, DashboardSummaryModule],
    });
    useCase = ctx.app.get(GetDashboardSummaryUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('a caller scoped to a single organizational unit sees a smaller CONTROL_INACTIVE_COUNT than a caller holding a global scope grant, over the SAME database', async () => {
    const narrowUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('dashboard-summary-scope-narrow'),
    });
    const otherUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('dashboard-summary-scope-other'),
    });

    // Two non-ACTIVE controls in the narrow caller's own unit.
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('dbsc-ctl-narrow-1'),
        name: 'Controle A do escopo estreito',
        orgUnitId: narrowUnit.id,
        status: 'DRAFT',
      },
    });
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('dbsc-ctl-narrow-2'),
        name: 'Controle B do escopo estreito',
        orgUnitId: narrowUnit.id,
        status: 'SUSPENDED',
      },
    });
    // One more non-ACTIVE control OUTSIDE the narrow caller's own unit —
    // only the broad (global-scope) caller can see it.
    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('dbsc-ctl-other-1'),
        name: 'Controle fora do escopo estreito',
        orgUnitId: otherUnit.id,
        status: 'DRAFT',
      },
    });

    const narrowActor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('dashboard-summary-narrow-actor')}@example.test`,
      primaryOrgUnitId: narrowUnit.id,
    });
    const narrowRole = await createRoleWithPermissionsFixture(ctx.prisma, ['control:view'], {
      name: `fixture-dashboard-summary-narrow-role-${uniqueTestMarker('role')}`,
    });
    await assignRoleFixture(ctx.prisma, { user: narrowActor, role: narrowRole });
    await grantUnitScopeFixture(ctx.prisma, { user: narrowActor, orgUnitId: narrowUnit.id });

    const broadActor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('dashboard-summary-broad-actor')}@example.test`,
    });
    const broadRole = await createRoleWithPermissionsFixture(ctx.prisma, ['control:view'], {
      name: `fixture-dashboard-summary-broad-role-${uniqueTestMarker('role')}`,
    });
    await assignRoleFixture(ctx.prisma, { user: broadActor, role: broadRole });
    await grantGlobalScopeFixture(ctx.prisma, { user: broadActor });

    const narrowResult = await useCase.execute({ actorUserId: narrowActor.id });
    const broadResult = await useCase.execute({ actorUserId: broadActor.id });

    const narrowControlItem = narrowResult.metrics.find(
      (metric) => metric.metricKey === 'CONTROL_INACTIVE_COUNT',
    );
    const broadControlItem = broadResult.metrics.find(
      (metric) => metric.metricKey === 'CONTROL_INACTIVE_COUNT',
    );

    // Both callers hold `control:view`, so the key is present for both —
    // never omitted here (that is the permission-filtering unit test's own
    // job; this file's only job is proving scope).
    expect(narrowControlItem).toBeDefined();
    expect(broadControlItem).toBeDefined();

    expect(narrowControlItem!.value).toBe(2);
    expect(broadControlItem!.value).toBeGreaterThanOrEqual(3);
    expect(broadControlItem!.value!).toBeGreaterThan(narrowControlItem!.value!);
  });
});
