/**
 * 009-indicators-reports, T032, item 2 (coordinator-mandated guard) —
 * `ACTION_OVERDUE_COUNT` is computed by a SQL `WHERE` predicate in
 * `PrismaActionRepository.countOverdueInScope`
 * (`grc/action/infrastructure/prisma-action.repository.ts`:
 * `status: { in: [...OVERDUE_ELIGIBLE_ACTION_STATUSES] }, dueOn: { lt:
 * referenceDate }`, applied through `ActionScopedRepository.applyScope`),
 * never by `isActionOverdue`
 * (`grc/shared/domain/overdue.service.ts`) — that function operates on an
 * already-loaded object and cannot serve as a `WHERE` clause. Both read the
 * SAME `OVERDUE_ELIGIBLE_ACTION_STATUSES` constant, but the predicate now
 * exists expressed in two independent forms (a Prisma query shape and a
 * plain TypeScript function) — exactly the class of defect `F-24`
 * (`docs/deferred-findings.md`) already paid to consolidate once (four
 * duplicates of the same "is this overdue" rule).
 *
 * This file proves the two forms still agree, over a deliberately
 * adversarial set of rows: due exactly today (the strict `<` boundary),
 * an ineligible status with an overdue date, and an ineligible status with
 * a due date of today. `Action.dueOn` is a required, non-nullable column
 * (`schema.prisma`: `dueOn DateTime @map("due_on") @db.Date` — no `?`,
 * confirmed by `grc/shared/domain/overdue.service.ts`'s own header: "There
 * is no 'no deadline' case to special-case, unlike `Risk.nextReviewOn`"),
 * so "an action with no due date" is structurally impossible to construct
 * and is not attempted here.
 *
 * Path 1 ("the SQL path") is exercised through the REAL production request
 * path — `GetIndicatorCurrentValueUseCase.execute` for `ACTION_OVERDUE_COUNT`
 * — not by calling the repository method directly, so this guard also
 * covers permission/scope wiring, not just the raw predicate.
 *
 * Path 2 ("the predicate path") loads every row in the SAME organizational
 * unit directly via Prisma (a plain `findMany`, no `status`/`dueOn` filter
 * at the database level at all) and applies `isActionOverdue` to each row
 * in TypeScript — the ONLY overdue-ness decision this test's own code ever
 * makes is calling that imported function; this file never re-implements
 * the rule itself.
 *
 * If the two paths ever disagree, this test MUST fail — never adjusted to
 * match whichever number the SQL path happens to return.
 */
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

    // `todayDateOnlyUtc()` is the SAME wall-clock reader every overdue
    // check in this platform uses (`grc/shared/domain/overdue.service.ts`)
    // — reusing it here is reusing "what is today", never the predicate
    // under test (`isActionOverdue`/the SQL `WHERE`), which this file
    // applies itself, once, per row, below.
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
      /** Expected outcome, computed BY HAND against data-model.md §6
       * ("status ∈ {OPEN, IN_PROGRESS} e dueOn < hoje") — not by calling
       * either path under test — so a wrong row-list is itself visible in
       * review, not hidden behind whichever path happens to agree with it. */
      readonly expectedOverdue: boolean;
    }

    const rows: readonly Row[] = [
      { status: 'OPEN', dueOn: yesterday, expectedOverdue: true },
      { status: 'IN_PROGRESS', dueOn: yesterday, expectedOverdue: true },
      // Boundary: due exactly today is NOT yet overdue (strict `<`).
      { status: 'OPEN', dueOn: today, expectedOverdue: false },
      { status: 'OPEN', dueOn: tomorrow, expectedOverdue: false },
      // Ineligible status with an overdue date — status gate must win.
      { status: 'COMPLETED', dueOn: yesterday, expectedOverdue: false },
      { status: 'CANCELLED', dueOn: yesterday, expectedOverdue: false },
      { status: 'IN_PROGRESS', dueOn: farFuture, expectedOverdue: false },
      { status: 'OPEN', dueOn: farPast, expectedOverdue: true },
      // Ineligible status, due exactly today — belt and suspenders on the
      // status gate at the SAME boundary date used above.
      { status: 'COMPLETED', dueOn: today, expectedOverdue: false },
      { status: 'CANCELLED', dueOn: tomorrow, expectedOverdue: false },
    ];

    for (const row of rows) {
      // Invariant A1 (DB CHECK `actions_completed_status_check`): `status =
      // 'COMPLETED'` iff `completedAt IS NOT NULL`, paired with
      // `completedByUserId` — both filled together for the two COMPLETED
      // rows in the table above.
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
    expect(expectedOverdueCount).toBe(3); // sanity: the hand-computed row list itself

    // Path 2 — load the SAME rows this unit has (no status/dueOn filter at
    // the database level at all) and apply `isActionOverdue` per row.
    const loadedRows = await ctx.prisma.client.action.findMany({
      where: { orgUnitId: orgUnit.id },
      select: { status: true, dueOn: true },
    });
    expect(loadedRows).toHaveLength(rows.length);
    const predicatePathCount = loadedRows.filter((row) =>
      isActionOverdue(row.dueOn, row.status, today),
    ).length;
    expect(predicatePathCount).toBe(expectedOverdueCount);

    // Path 1 — the real production request path.
    const result = await useCase.execute({
      actorUserId: actor.id,
      metricKey: 'ACTION_OVERDUE_COUNT',
    });
    const sqlPathCount = result.value;

    expect(sqlPathCount).toBe(expectedOverdueCount);
    expect(sqlPathCount).toBe(predicatePathCount);
  });
});
