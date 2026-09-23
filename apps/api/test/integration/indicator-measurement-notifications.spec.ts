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

    expect(after.length).toBe(before + 1);

    const notification = after[after.length - 1]!;
    expect(notification.recipientUserId).toBe(owner.id);
    expect(notification.entityType).toBe('INDICATOR');
    expect(notification.entityId).toBe(definition.id);
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

    expect(after).toBe(before);
  });

  it('a metric key with no IndicatorDefinition at all never breaches and produces zero notifications, for any recipient', async () => {
    const { actor } = await createGlobalActor('notify-no-definition', [
      'indicator:edit',
      'indicator:view',
      'action:view',
    ]);

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
