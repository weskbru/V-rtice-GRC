/**
 * 007-implementation-remediation, Frente A — coordinator-required
 * consolidation proof for the overdue-eligible `ActionStatus` set
 * (R-006/FR-014/data-model.md §6, `grc/shared/domain/overdue.service.ts`).
 *
 * Reading the three call sites and finding them textually identical is NOT
 * consolidation and is not a test — it only shows that nobody had changed
 * one without the others YET. The defect this file exists to close is
 * "nothing forces them to agree", not "they currently agree". So this
 * suite does two different things, and both are required:
 *
 *   1. For every `ActionStatus` (OPEN, IN_PROGRESS, COMPLETED, CANCELLED)
 *      crossed with yesterday/today/tomorrow (12 cases), it compares THREE
 *      independent encodings of the SAME rule, each exercised for real
 *      against the real database — never re-derived or assumed equal:
 *        a. the TypeScript predicate, `isActionOverdue`;
 *        b. a real SQL query executed against Postgres —
 *           `DashboardQueryService.getOverdueActions`/
 *           `getTreatmentActionsSummary`, the exact production methods
 *           `risk-dashboard.controller.ts` calls, unmodified for this test;
 *        c. the Prisma repository filter — `PrismaActionRepository.list()`
 *           with `overdue: true`, the exact production method
 *           `ListActionUseCase`/`RiskTreatmentActionQueryService` call.
 *
 *   2. It then PROVES the wiring, not just today's agreement: it mutates
 *      `OVERDUE_ELIGIBLE_ACTION_STATUSES` at runtime (the ONE array all
 *      three encodings above are supposed to derive from) to make a
 *      normally-terminal status (`COMPLETED`) overdue-eligible, re-runs
 *      the SAME three checks against the SAME `COMPLETED`+past-due action,
 *      and asserts all three flip from "not overdue" to "overdue"
 *      TOGETHER — then restores the array in a `finally` block. A test
 *      that only confirmed today's agreement would pass identically
 *      whether or not any call site actually reads the shared array (it
 *      could hard-code the same two strings and still pass) — this second
 *      half is what rules that out.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PrismaActionRepository } from '../../src/grc/action/infrastructure/prisma-action.repository';
import {
  isActionOverdue,
  OVERDUE_ELIGIBLE_ACTION_STATUSES,
  todayDateOnlyUtc,
} from '../../src/grc/shared/domain/overdue.service';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { CreateTreatmentActionUseCase } from '../../src/modules/risk/application/treatment-actions/create-treatment-action.usecase';
import { DashboardQueryService } from '../../src/modules/risk/infrastructure/dashboard-query.service';
import { RiskModule } from '../../src/modules/risk/risk.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { ActionStatus } from '@prisma/client';

// The REAL "today" — `todayDateOnlyUtc()` is exactly what the SQL side
// (`getOverdueActions`/`getTreatmentActionsSummary`) calls internally to
// build its own `todayParam`. A fictional, hard-coded reference date here
// would only agree with the TypeScript predicate (which takes whatever
// `referenceDate` this file passes) while silently disagreeing with the
// SQL side (which always asks the real system clock) — exactly the kind
// of mismatch this file exists to catch, not to introduce by accident.
const TODAY = todayDateOnlyUtc();
function isoDateOffset(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const YESTERDAY = isoDateOffset(-1);
const TODAY_DATE = isoDateOffset(0);
const TOMORROW = isoDateOffset(1);
const ALL_STATUSES: readonly ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

describe('Overdue-eligible status set — one authority, proven, not assumed (007-implementation-remediation)', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createTreatmentActionUseCase: CreateTreatmentActionUseCase;
  let dashboardQuery: DashboardQueryService;
  let actionRepository: PrismaActionRepository;
  let actorUserId: string;
  let orgUnitId: string;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createTreatmentActionUseCase = ctx.app.get(CreateTreatmentActionUseCase);
    dashboardQuery = new DashboardQueryService(ctx.prisma);
    actionRepository = new PrismaActionRepository(ctx.prisma);

    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('overdue-consol-org'),
    });
    orgUnitId = orgUnit.id;
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('overdue-consol-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    actorUserId = actor.id;
    const role = await createRoleWithPermissionsFixture(
      ctx.prisma,
      ['risk:create', 'risk:view', 'risk:treat'],
      { name: `fixture-overdue-consol-role-${randomUUID()}` },
    );
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** Creates a real, fully-linked Action (via the real create path, so it
   * has a real code/link row/audit trail) and then force-sets `status`/
   * `due_on` directly — the transition table is a different, already-
   * proven concern (`risk-action-convergence.spec.ts`); this file only
   * needs specific (status, dueOn) combinations to exist. */
  async function createActionWith(status: ActionStatus, dueOn: string): Promise<string> {
    const risk = await createRiskUseCase.execute({
      actorUserId,
      title: 'Risco descartável para combinação de status/prazo',
      description: 'Descrição.',
      orgUnitId,
      ownerUserId: actorUserId,
    });
    const created = await createTreatmentActionUseCase.execute({
      actorUserId,
      riskId: risk.id,
      expectedVersion: risk.version,
      title: `Ação ${status} vencendo ${dueOn}`,
      responsibleUserId: actorUserId,
      dueOn: '2026-12-31',
    });
    await ctx.prisma.client.$executeRawUnsafe(
      `UPDATE actions SET status = $1::"ActionStatus", due_on = $2::date, completed_at = CASE WHEN $1 = 'COMPLETED' THEN now() ELSE NULL END, completed_by_user_id = CASE WHEN $1 = 'COMPLETED' THEN $3::uuid ELSE NULL END WHERE id = $4::uuid`,
      status,
      dueOn,
      actorUserId,
      created.action.id,
    );
    return created.action.id;
  }

  async function checkAllThreeEncodings(
    actionId: string,
    status: ActionStatus,
    dueOnIso: string,
  ): Promise<{ predicate: boolean; sqlQuery: boolean; prismaFilter: boolean }> {
    const dueOn = new Date(`${dueOnIso}T00:00:00.000Z`);
    const predicate = isActionOverdue(dueOn, status, TODAY);

    const overdueItems = await dashboardQuery.getOverdueActions({ kind: 'GLOBAL' }, 500);
    const sqlQuery = overdueItems.items.some((item) => item.actionId === actionId);

    const filtered = await actionRepository.list(
      { kind: 'UNRESTRICTED' },
      { originType: 'RISK_TREATMENT', overdue: true },
      1,
      500,
    );
    const prismaFilter = filtered.items.some((item) => item.id === actionId);

    return { predicate, sqlQuery, prismaFilter };
  }

  describe.each(ALL_STATUSES)('status = %s', (status) => {
    it.each([
      ['yesterday (past due)', YESTERDAY],
      ['today (due today, not yet overdue)', TODAY_DATE],
      ['tomorrow (future)', TOMORROW],
    ])(
      '%s — TypeScript predicate, real SQL query and Prisma filter all agree',
      async (_label, dueOn) => {
        const actionId = await createActionWith(status, dueOn);
        const { predicate, sqlQuery, prismaFilter } = await checkAllThreeEncodings(
          actionId,
          status,
          dueOn,
        );

        expect(sqlQuery, 'SQL-executed-for-real result must match the TS predicate').toBe(
          predicate,
        );
        expect(prismaFilter, 'Prisma-filter result must match the TS predicate').toBe(predicate);
      },
    );
  });

  it('PROOF IT BITES: mutating the one authoritative array flips all three encodings together, then restores it', async () => {
    // A COMPLETED action, past due — today, by design, "not overdue" in
    // all three encodings (COMPLETED is terminal).
    const actionId = await createActionWith('COMPLETED', YESTERDAY);

    const before = await checkAllThreeEncodings(actionId, 'COMPLETED', YESTERDAY);
    expect(before).toEqual({ predicate: false, sqlQuery: false, prismaFilter: false });

    // `OVERDUE_ELIGIBLE_ACTION_STATUSES` is declared `readonly ActionStatus[]`
    // at the TYPE level only — at runtime it is an ordinary, mutable Array
    // instance (the same technique this codebase already uses for
    // `LEGAL_TRANSITIONS` and other "prove the guard" tests). Casting away
    // the readonly view here is deliberate and test-only.
    const mutable = OVERDUE_ELIGIBLE_ACTION_STATUSES as unknown as ActionStatus[];
    mutable.push('COMPLETED');
    try {
      const after = await checkAllThreeEncodings(actionId, 'COMPLETED', YESTERDAY);
      expect(
        after,
        'all three encodings must flip to overdue=true together once the shared array changes — ' +
          'if any of them still says false, that encoding is not actually deriving from this array',
      ).toEqual({ predicate: true, sqlQuery: true, prismaFilter: true });
    } finally {
      const index = mutable.indexOf('COMPLETED');
      if (index !== -1) {
        mutable.splice(index, 1);
      }
    }

    // Restoration actually took effect — the next call, after the array is
    // back to its real shape, must return to the original (false) answer.
    const restored = await checkAllThreeEncodings(actionId, 'COMPLETED', YESTERDAY);
    expect(restored).toEqual({ predicate: false, sqlQuery: false, prismaFilter: false });
  });

  afterEach(() => {
    // Belt-and-braces: even if an assertion above threw before the
    // `finally` block ran (it should not, but this guards against exactly
    // the kind of state leak that would silently corrupt every OTHER test
    // in this file, since they all import the same module-level array),
    // guarantee no test ever leaves 'COMPLETED' registered as eligible.
    const mutable = OVERDUE_ELIGIBLE_ACTION_STATUSES as unknown as ActionStatus[];
    const index = mutable.indexOf('COMPLETED');
    if (index !== -1) {
      mutable.splice(index, 1);
    }
    expect(OVERDUE_ELIGIBLE_ACTION_STATUSES).toEqual(['OPEN', 'IN_PROGRESS']);
  });
});
