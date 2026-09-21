/**
 * 009-indicators-reports, Fase 5 (T039/T040) — the first real integration
 * proof of a `NotificationService` producer (spec.md FR-017/SC-003,
 * research.md D-7, CLAUDE.md §19.10). Uses `CreateIndicatorMeasurementUseCase`
 * directly (never HTTP), the same shape `indicator-measurements.spec.ts`
 * (T038) already established for this module's own integration coverage.
 *
 * Both tests read the ROW BACK FROM THE REAL `notifications` TABLE via
 * `ctx.prisma.client.notification` — never a spy on `NotificationService`
 * itself (`plan.md`'s own risk table, quoted verbatim in `tasks.md` T039:
 * "lida pelo repositório real (não um mock de `NotificationService`)"). A
 * test that only asserted `NotificationService.notify` was CALLED would
 * pass even if `PrismaNotificationRepository.create` silently failed to
 * persist anything — reading the table is what actually proves a
 * notification exists.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateIndicatorMeasurementUseCase } from '../../src/modules/indicators/application/create-indicator-measurement.usecase';
import { IndicatorsModule } from '../../src/modules/indicators/indicators.module';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

describe('IndicatorMeasurement — threshold-breach notification (T039/T040)', () => {
  let ctx: IntegrationTestContext;
  let createUseCase: CreateIndicatorMeasurementUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IndicatorsModule],
    });
    createUseCase = ctx.app.get(CreateIndicatorMeasurementUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A `GLOBAL`-scoped actor (research.md D-6) holding exactly the
   * permissions given — mirrors `indicator-measurements.spec.ts`'s (T038)
   * own helper. */
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

  it('T039: a measurement that breaches its configured threshold produces exactly one row in notifications, addressed to the indicator owner', async () => {
    // `CONTROL_INACTIVE_COUNT`, not `ASSET_INACTIVE_COUNT` —
    // `indicator-measurements.spec.ts` (T038) already owns the ONE
    // `IndicatorDefinition` row this shared test database ever creates for
    // `ASSET_INACTIVE_COUNT` (`metricKey` is `UNIQUE` — data-model.md §1);
    // creating a second one there would fail on that constraint, not on
    // anything this test is trying to prove.
    const { actor, orgUnit } = await createGlobalActor('notify-breach', [
      'indicator:edit',
      'indicator:view',
      'control:view',
    ]);

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('notify-breach-owner')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });

    await ctx.prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-notify'),
        name: 'Controle para notificação de rompimento',
        orgUnitId: orgUnit.id,
        status: 'DRAFT',
      },
    });

    // The real total is queried independently rather than assumed to be
    // exactly 1 — this suite shares one database across every integration
    // spec file (`vitest.integration.config.ts`: `fileParallelism: false`),
    // the same reasoning `indicator-measurements.spec.ts` applies to its
    // own assertions. `ControlInactiveCountProvider` counts every
    // non-`ACTIVE` status (`DRAFT`/`SUSPENDED`/`RETIRED`).
    const totalInactiveControls = await ctx.prisma.client.control.count({
      where: { status: { in: ['DRAFT', 'SUSPENDED', 'RETIRED'] } },
    });
    expect(totalInactiveControls).toBeGreaterThanOrEqual(1);

    const definition = await ctx.prisma.client.indicatorDefinition.create({
      data: {
        code: uniqueTestMarker('IND-notify-breach'),
        metricKey: 'CONTROL_INACTIVE_COUNT',
        name: 'Controles inativos (notificação)',
        description: 'Descrição.',
        ownerUserId: owner.id,
        thresholdComparator: 'GTE',
        thresholdValue: 1,
        createdByUserId: actor.id,
      },
    });

    const before = await ctx.prisma.client.notification.count({
      where: { recipientUserId: owner.id },
    });

    const created = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'CONTROL_INACTIVE_COUNT',
    });
    expect(created.record.breached).toBe(true);

    const after = await ctx.prisma.client.notification.findMany({
      where: { recipientUserId: owner.id },
      orderBy: { createdAt: 'asc' },
    });

    // EXACTLY one new row for this owner — not merely "at least one".
    expect(after.length).toBe(before + 1);

    const notification = after[after.length - 1]!;
    expect(notification.recipientUserId).toBe(owner.id);
    // FR-018 — the deep link uses `CommentableEntityType.INDICATOR`, at
    // the `IndicatorDefinition`'s own id (`indicator-parent-record-
    // accessor.ts`'s own resolution target), never the acting user, never
    // the `IndicatorMeasurement`'s own id.
    expect(notification.entityType).toBe('INDICATOR');
    expect(notification.entityId).toBe(definition.id);
    // T042 — the body names the indicator and the calculated value, via
    // the SAME catalog template the use case calls (never a re-typed
    // literal here that could silently drift from the real message).
    expect(notification.title).toBe(
      USER_MESSAGES.indicators.thresholdBreachedTitle(definition.name),
    );
    expect(notification.body).toBe(
      USER_MESSAGES.indicators.thresholdBreachedBody(definition.name, String(created.record.value)),
    );
    expect(notification.body).toContain(definition.name);
    expect(notification.body).toContain(String(totalInactiveControls));
    expect(notification.readAt).toBeNull();
  });

  it('T040: a measurement that does not breach its configured threshold produces zero notifications', async () => {
    const { actor, orgUnit } = await createGlobalActor('notify-no-breach', [
      'indicator:edit',
      'indicator:view',
      'process:view',
    ]);

    const owner = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('notify-no-breach-owner')}@example.test`,
      primaryOrgUnitId: orgUnit.id,
    });

    // A threshold set far above any plausible total, so the real count —
    // whatever it is, shared across every spec file in this run — can
    // never breach it.
    await ctx.prisma.client.indicatorDefinition.create({
      data: {
        code: uniqueTestMarker('IND-notify-no-breach'),
        metricKey: 'PROCESS_INACTIVE_COUNT',
        name: 'Processos inativos (sem rompimento)',
        description: 'Descrição.',
        ownerUserId: owner.id,
        thresholdComparator: 'GTE',
        thresholdValue: 1_000_000,
        createdByUserId: actor.id,
      },
    });

    const before = await ctx.prisma.client.notification.count({
      where: { recipientUserId: owner.id },
    });

    const created = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
    });
    expect(created.record.breached).toBe(false);

    const after = await ctx.prisma.client.notification.count({
      where: { recipientUserId: owner.id },
    });

    // Zero new rows — the counterpart the T039 test alone could not prove
    // (a use case that notified unconditionally would still pass a
    // breach-only test).
    expect(after).toBe(before);
  });

  it('a metric key with no IndicatorDefinition at all never breaches and produces zero notifications, for any recipient', async () => {
    const { actor } = await createGlobalActor('notify-no-definition', [
      'indicator:edit',
      'indicator:view',
      'action:view',
    ]);

    // `ACTION_OVERDUE_COUNT` — the one `SINGLE_VALUE` metric key no test
    // file in this suite ever creates an `IndicatorDefinition` for
    // (`CONTROL_INACTIVE_COUNT` above and `ASSET_INACTIVE_COUNT` in
    // `indicator-measurements.spec.ts` both already have one; `metricKey`
    // is `UNIQUE`, so reusing either here for "no definition exists" would
    // be false the moment this file runs after — or before — the other
    // test that configures it). `findByMetricKey` resolves `undefined`
    // for it here.
    const totalNotificationsBefore = await ctx.prisma.client.notification.count();

    const created = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'ACTION_OVERDUE_COUNT',
    });
    expect(created.record.breached).toBe(false);

    const totalNotificationsAfter = await ctx.prisma.client.notification.count();
    expect(totalNotificationsAfter).toBe(totalNotificationsBefore);
  });
});
