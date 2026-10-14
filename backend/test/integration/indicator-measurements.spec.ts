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

    const beforeFirst = await countAllInactiveProcesses();
    await createInactiveProcess();
    const first = await createUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'PROCESS_INACTIVE_COUNT',
    });
    expect(first.record.value).toBe(beforeFirst + 1);

    await delay(20);

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

    const totalInactiveAtCreation = await ctx.prisma.client.asset.count({
      where: { isActive: false },
    });
    expect(totalInactiveAtCreation).toBeGreaterThanOrEqual(1);

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
    expect(persisted?.record.value).toBe(totalInactiveAtCreation);
    expect(persisted?.record.breached).toBe(true);

    const currentValue = await getCurrentValueUseCase.execute({
      actorUserId: actor.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });
    expect(currentValue.value).toBe(totalInactiveAtCreation - 1);
  });
});
