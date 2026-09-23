import { randomUUID } from 'node:crypto';

import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { isActionOverdue, todayDateOnlyUtc } from '../../src/grc/shared/domain/overdue.service';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { GetIndicatorCurrentValueUseCase } from '../../src/modules/indicators/application/get-indicator-current-value.usecase';
import { IndicatorsModule } from '../../src/modules/indicators/indicators.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { ActionStatus } from '@prisma/client';

describe('ACTION_OVERDUE_COUNT — the SQL predicate and isActionOverdue() agree over adversarial rows (F-24)', () => {
  let ctx: IntegrationTestContext;
  let useCase: GetIndicatorCurrentValueUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IndicatorsModule],
    });
    useCase = ctx.app.get(GetIndicatorCurrentValueUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('SQL COUNT(*) via GetIndicatorCurrentValueUseCase agrees, row for row, with isActionOverdue() applied to the same loaded rows', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('action-overdue-parity'),
    });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('action-overdue-parity-actor')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['indicator:view', 'action:view'],
      { name: `fixture-action-overdue-parity-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId: orgUnit.id });

    const today = todayDateOnlyUtc();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const farPast = new Date(today);
    farPast.setUTCDate(farPast.getUTCDate() - 400);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const farFuture = new Date(today);
    farFuture.setUTCDate(farFuture.getUTCDate() + 400);

    interface Row {
      readonly status: ActionStatus;
      readonly dueOn: Date;
      readonly expectedOverdue: boolean;
    }

    const rows: readonly Row[] = [
      { status: 'OPEN', dueOn: yesterday, expectedOverdue: true },
      { status: 'IN_PROGRESS', dueOn: yesterday, expectedOverdue: true },
      { status: 'OPEN', dueOn: today, expectedOverdue: false },
      { status: 'OPEN', dueOn: tomorrow, expectedOverdue: false },
      { status: 'COMPLETED', dueOn: yesterday, expectedOverdue: false },
      { status: 'CANCELLED', dueOn: yesterday, expectedOverdue: false },
      { status: 'IN_PROGRESS', dueOn: farFuture, expectedOverdue: false },
      { status: 'OPEN', dueOn: farPast, expectedOverdue: true },
      { status: 'COMPLETED', dueOn: today, expectedOverdue: false },
      { status: 'CANCELLED', dueOn: tomorrow, expectedOverdue: false },
    ];

    for (const row of rows) {
      const completed = row.status === 'COMPLETED';
      await ctx.prisma.client.action.create({
        data: {
          code: uniqueTestMarker('act-parity'),
          orgUnitId: orgUnit.id,
          originType: 'CONTROL_ASSESSMENT',
          originId: randomUUID(),
          title: 'Ação para paridade de predicado de vencimento',
          responsibleUserId: actor.id,
          dueOn: row.dueOn,
          status: row.status,
          completedAt: completed ? new Date() : null,
          completedByUserId: completed ? actor.id : null,
        },
      });
    }

    const expectedOverdueCount = rows.filter((row) => row.expectedOverdue).length;
    expect(expectedOverdueCount).toBe(3);

    const loadedRows = await ctx.prisma.client.action.findMany({
      where: { orgUnitId: orgUnit.id },
      select: { status: true, dueOn: true },
    });
    expect(loadedRows).toHaveLength(rows.length);
    const predicatePathCount = loadedRows.filter((row) =>
      isActionOverdue(row.dueOn, row.status, today),
    ).length;
    expect(predicatePathCount).toBe(expectedOverdueCount);

    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'ACTION_OVERDUE_COUNT',
    });
    const sqlPathCount = result.value;

    expect(sqlPathCount).toBe(expectedOverdueCount);
    expect(sqlPathCount).toBe(predicatePathCount);
  });
});
