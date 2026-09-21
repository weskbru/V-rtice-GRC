/**
 * 009-indicators-reports, Fase 4 (T038) — the two facts about
 * `IndicatorMeasurement` only the real database can prove (this task's own
 * instructions restrict this file's scope to exactly these two; the
 * `403`-for-`UNIT`-scope and routing-immutability halves of the original
 * `tasks.md` T038 description are covered at the HTTP layer instead, by
 * `test/contract/indicators.spec.ts`'s `POST`/`GET .../measurements`
 * describe blocks):
 *
 * 1. Two points recorded at different moments come back from
 *    `ListIndicatorMeasurementsUseCase` in chronological order, oldest
 *    first (`contracts/indicators.openapi.yaml`'s own
 *    `listIndicatorMeasurements` description) — proved against REAL
 *    `computedAt` timestamps written by two separate calls, not asserted
 *    against insertion order alone.
 * 2. `breached` is calculated ONCE, at `CreateIndicatorMeasurementUseCase`
 *    time (research.md D-7), and never recomputed when the point is read
 *    back later — proved by changing BOTH the underlying source data and
 *    the indicator's own threshold AFTER the point was created, then
 *    showing the already-created point's `breached`/`value` are
 *    unaffected by either change, while a fresh
 *    `GetIndicatorCurrentValueUseCase` call in the same instant reflects
 *    the NEW state. Two independently-observable facts (the stored point,
 *    and a fresh live computation) diverging is the actual proof — a test
 *    that only re-read the stored point would not distinguish "never
 *    recomputed" from "recomputed to the same, coincidentally unchanged,
 *    number".
 *
 * Uses the two use cases directly (never HTTP) — the same shape
 * `indicator-current-value-organizational-scope.spec.ts` (T032) already
 * established for this module's other integration coverage.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateIndicatorMeasurementUseCase } from '../../src/modules/indicators/application/create-indicator-measurement.usecase';
import { GetIndicatorCurrentValueUseCase } from '../../src/modules/indicators/application/get-indicator-current-value.usecase';
import { ListIndicatorMeasurementsUseCase } from '../../src/modules/indicators/application/list-indicator-measurements.usecase';
import { IndicatorsModule } from '../../src/modules/indicators/indicators.module';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('IndicatorMeasurement — history ordering and breached persistence (T038)', () => {
  let ctx: IntegrationTestContext;
  let createUseCase: CreateIndicatorMeasurementUseCase;
  let listUseCase: ListIndicatorMeasurementsUseCase;
  let getCurrentValueUseCase: GetIndicatorCurrentValueUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IndicatorsModule],
    });
    createUseCase = ctx.app.get(CreateIndicatorMeasurementUseCase);
    listUseCase = ctx.app.get(ListIndicatorMeasurementsUseCase);
    getCurrentValueUseCase = ctx.app.get(GetIndicatorCurrentValueUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A `GLOBAL`-scoped actor (research.md D-6) holding exactly the
   * permissions given. */
  async function createGlobalActor(prefix: string, permissions: readonly PermissionIdentifier[]) {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, { code: uniqueTestMarker(prefix) });
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker(prefix)}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: uniqueTestMarker(`fixture-${prefix}-role`),
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantGlobalScopeFixture(ctx.prisma, { user: actor });
    return { actor, orgUnit };
  }

  it('records two points at different moments and reads them back oldest-first', async () => {
    const { actor, orgUnit } = await createGlobalActor('measurement-order', [
      'indicator:edit',
      'indicator:view',
      'process:view',
    ]);

    // `PROCESS_INACTIVE_COUNT` is `ORGANIZATIONAL_UNIT`-scoped (data-model.md
    // §3), but a `GLOBAL`-scoped caller (research.md D-6 — required for
    // this whole sub-resource) sees the count across EVERY unit, not just
    // `orgUnit` — and this suite shares one database across every
    // integration spec file (`vitest.integration.config.ts`:
    // `fileParallelism: false`, reset only once per run). So the value this
    // use case returns is never "the one inactive process this test just
    // created" in isolation; it is "however many inactive processes exist
    // anywhere, including ones other spec files left behind". Each
    // assertion below is therefore phrased against an independently
    // queried baseline, never a hard-coded absolute count.
    async function countAllInactiveProcesses(): Promise<number> {
      return ctx.prisma.client.process.count({ where: { isActive: false } });
    }

    async function createInactiveProcess() {
      return ctx.prisma.client.process.create({
        data: {
          code: uniqueTestMarker('prc-order'),
          name: 'Processo para ordenação de histórico',
          orgUnitId: orgUnit.id,
          isActive: false,
        },
      });
    }

    // First point — one MORE inactive process than whatever already exists.
    const beforeFirst = await countAllInactiveProcesses();
    await createInactiveProcess();
    const first = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
    });
    expect(first.record.value).toBe(beforeFirst + 1);

    // A real gap in wall-clock time before the second point, so the two
    // `computedAt` values are provably distinct — not merely "inserted in
    // this order" but "computed at genuinely different instants".
    await delay(20);

    // Second point — one more inactive process again.
    await createInactiveProcess();
    const second = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
    });
    expect(second.record.value).toBe(first.record.value! + 1);

    expect(second.record.computedAt.getTime()).toBeGreaterThan(first.record.computedAt.getTime());

    const page = await listUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
      page: 1,
      pageSize: 100,
    });

    const firstIndex = page.items.findIndex((item) => item.record.id === first.record.id);
    const secondIndex = page.items.findIndex((item) => item.record.id === second.record.id);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(page.items[firstIndex]?.record.value).toBe(first.record.value);
    expect(page.items[secondIndex]?.record.value).toBe(second.record.value);

    // The series really is sorted by `computedAt`, not merely by creation
    // sequence that happens to agree with it here.
    for (let i = 1; i < page.items.length; i += 1) {
      expect(page.items[i]!.record.computedAt.getTime()).toBeGreaterThanOrEqual(
        page.items[i - 1]!.record.computedAt.getTime(),
      );
    }
  });

  it('persists breached as calculated at creation time and never recomputes it on read (research.md D-7)', async () => {
    const { actor, orgUnit } = await createGlobalActor('measurement-breach', [
      'indicator:edit',
      'indicator:view',
      'asset:view',
    ]);

    const asset = await ctx.prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('ast-breach'),
        name: 'Ativo para persistência de rompimento',
        orgUnitId: orgUnit.id,
        isActive: false,
      },
    });

    // `ASSET_INACTIVE_COUNT` under a `GLOBAL`-scoped caller (research.md
    // D-6) counts across every org unit, not just `orgUnit` — and this
    // suite shares one database across every integration spec file
    // (`vitest.integration.config.ts`: `fileParallelism: false`). Query the
    // REAL total independently, right after creating the one asset above,
    // rather than assuming it is exactly 1 — the same reasoning the
    // ordering test above applies.
    const totalInactiveAtCreation = await ctx.prisma.client.asset.count({
      where: { isActive: false },
    });
    expect(totalInactiveAtCreation).toBeGreaterThanOrEqual(1);

    // A threshold the current total definitely breaches: GTE 1 — true
    // regardless of how many inactive assets already existed, since we
    // just added one.
    const definition = await ctx.prisma.client.indicatorDefinition.create({
      data: {
        code: uniqueTestMarker('IND-breach'),
        metricKey: 'ASSET_INACTIVE_COUNT',
        name: 'Ativos inativos para teste de persistência',
        description: 'Descrição.',
        ownerUserId: actor.id,
        thresholdComparator: 'GTE',
        thresholdValue: 1,
        createdByUserId: actor.id,
      },
    });

    const created = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });
    expect(created.record.value).toBe(totalInactiveAtCreation);
    expect(created.record.breached).toBe(true);

    // Change BOTH the source data (this test's own asset is reactivated —
    // the live total drops by exactly one) AND the definition's own
    // threshold (raised well above any plausible total, so even the OLD
    // total would no longer breach it). If `breached`/`value` were ever
    // recomputed on read, either change alone would flip them.
    await ctx.prisma.client.asset.update({ where: { id: asset.id }, data: { isActive: true } });
    await ctx.prisma.client.indicatorDefinition.update({
      where: { id: definition.id },
      data: { thresholdValue: 1_000_000 },
    });

    const page = await listUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
      page: 1,
      pageSize: 100,
    });
    const persisted = page.items.find((item) => item.record.id === created.record.id);
    expect(persisted).toBeDefined();
    // Unchanged — the exact snapshot computed at creation time.
    expect(persisted?.record.value).toBe(totalInactiveAtCreation);
    expect(persisted?.record.breached).toBe(true);

    // Contrast: a FRESH live computation, right now, reflects the NEW
    // state (one fewer inactive asset than at creation time) — proving the
    // difference above is not a coincidence but a genuine "never
    // recomputed" guarantee for the stored point. (`GetIndicatorCurrentValueUseCase`
    // does not surface `breached` at all — US1 never evaluates a
    // threshold, only US2's `IndicatorMeasurement` does — so the contrast
    // is drawn on `value`, the field both use cases share.)
    const currentValue = await getCurrentValueUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });
    expect(currentValue.value).toBe(totalInactiveAtCreation - 1);
  });
});
