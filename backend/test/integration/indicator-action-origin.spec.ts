import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActionModule } from '../../src/grc/action/action.module';
import { CreateActionUseCase } from '../../src/grc/action/application/create-action.usecase';
import { GetActionUseCase } from '../../src/grc/action/application/get-action.usecase';
import { ListActionUseCase } from '../../src/grc/action/application/list-action.usecase';
import { TransitionActionUseCase } from '../../src/grc/action/application/transition-action.usecase';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { IndicatorsModule } from '../../src/modules/indicators/indicators.module';
import { NotFoundDomainError, ValidationDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type { IndicatorMetricKey } from '@prisma/client';

const CANDIDATE_METRIC_KEYS: readonly IndicatorMetricKey[] = [
  'AUDIT_ENGAGEMENT_OPEN_COUNT',
  'RISK_TOTAL_BY_LEVEL',
  'RISK_TREATMENT_OVERDUE_COUNT',
  'COMPLIANCE_PERCENTAGE',
  'FINDING_OPEN_COUNT_BY_SEVERITY',
  'ACTION_OVERDUE_COUNT',
  'INCIDENT_OPEN_COUNT_BY_SEVERITY',
  'PROBLEM_OPEN_COUNT_BY_SEVERITY',
];

describe('009-indicators-reports — INDICATOR action origin, genuinely exercised', () => {
  let ctx: IntegrationTestContext;
  let createActionUseCase: CreateActionUseCase;
  let getActionUseCase: GetActionUseCase;
  let listActionUseCase: ListActionUseCase;
  let transitionActionUseCase: TransitionActionUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IndicatorsModule, ActionModule],
    });
    createActionUseCase = ctx.app.get(CreateActionUseCase);
    getActionUseCase = ctx.app.get(GetActionUseCase);
    listActionUseCase = ctx.app.get(ListActionUseCase);
    transitionActionUseCase = ctx.app.get(TransitionActionUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('iao-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-iao-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupIndicatorDefinition(ownerId: string, createdByUserId: string) {
    for (const metricKey of CANDIDATE_METRIC_KEYS) {
      const existing = await ctx.prisma.client.indicatorDefinition.findUnique({
        where: { metricKey },
      });
      if (!existing) {
        return ctx.prisma.client.indicatorDefinition.create({
          data: {
            code: uniqueTestMarker('iao-ind'),
            metricKey,
            name: 'Indicador de teste — acessor de origem de Ação',
            description: 'Indicador de teste para o acessor de origem de Ação (T046).',
            ownerUserId: ownerId,
            createdByUserId,
          },
        });
      }
    }
    throw new Error(
      'setupIndicatorDefinition: every candidate IndicatorMetricKey already has a row — ' +
        'widen CANDIDATE_METRIC_KEYS or investigate the collision.',
    );
  }

  it('an Action created with originType INDICATOR appears in the shared work list and in "Minhas ações", identified by its origin', async () => {
    const ownerOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-owner-org'),
    });
    const owner = await setupActor(ownerOrgUnit.id, ['indicator:view']);
    const definition = await setupIndicatorDefinition(owner.id, owner.id);

    const actor = await setupActor(ownerOrgUnit.id, [
      'indicator:edit',
      'indicator:view',
      'action:create',
      'action:view',
    ]);

    const { record: action, originLabel } = await createActionUseCase.execute({
      actorUserId: actor.id,
      originType: 'INDICATOR',
      originId: definition.id,
      title: 'Investigar rompimento de limiar',
      responsibleUserId: actor.id,
      dueOn: '2026-09-19',
    });

    expect(action.originType).toBe('INDICATOR');
    expect(action.originId).toBe(definition.id);
    expect(originLabel).toContain(definition.code);
    expect(action.orgUnit.id).toBe(ownerOrgUnit.id);

    const byOrigin = await listActionUseCase.execute({
      actorUserId: actor.id,
      page: 1,
      pageSize: 25,
      originType: 'INDICATOR',
      originId: definition.id,
    });
    expect(byOrigin.items.map((item) => item.id)).toContain(action.id);

    const mine = await listActionUseCase.execute({
      actorUserId: actor.id,
      page: 1,
      pageSize: 25,
      responsibleUserId: actor.id,
    });
    expect(mine.items.map((item) => item.id)).toContain(action.id);
  });

  it('is organization-wide (FR-021): a caller scoped to a DIFFERENT, unrelated unit still creates and reads an Action from this origin — unlike INCIDENT/PROBLEM', async () => {
    const ownerOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-owner-org-2'),
    });
    const owner = await setupActor(ownerOrgUnit.id, ['indicator:view']);
    const definition = await setupIndicatorDefinition(owner.id, owner.id);

    const unrelatedOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-unrelated-org'),
    });
    const caller = await setupActor(unrelatedOrgUnit.id, [
      'indicator:edit',
      'indicator:view',
      'action:create',
      'action:view',
    ]);

    const { record: action } = await createActionUseCase.execute({
      actorUserId: caller.id,
      originType: 'INDICATOR',
      originId: definition.id,
      title: 'Ação a partir de indicador — chamador em unidade não relacionada',
      responsibleUserId: caller.id,
      dueOn: '2026-09-19',
    });
    expect(action.originType).toBe('INDICATOR');

    await expect(
      getActionUseCase.execute({ actorUserId: caller.id, actionId: action.id }),
    ).resolves.toMatchObject({ id: action.id });

    const thirdOrgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-third-org'),
    });
    const secondCaller = await setupActor(thirdOrgUnit.id, ['indicator:view', 'action:view']);
    const list = await listActionUseCase.execute({
      actorUserId: secondCaller.id,
      page: 1,
      pageSize: 25,
      originType: 'INDICATOR',
      originId: definition.id,
    });
    expect(list.items.map((item) => item.id)).toContain(action.id);
  });

  it('a nonexistent IndicatorDefinition origin is refused when creating an Action from it — indistinguishable from a real one the caller may not edit', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-nonexistent-org'),
    });
    const caller = await setupActor(orgUnit.id, ['action:create', 'indicator:edit']);

    const nonexistentId = randomUUID();
    await expect(
      createActionUseCase.execute({
        actorUserId: caller.id,
        originType: 'INDICATOR',
        originId: nonexistentId,
        title: 'Ação a partir de indicador inexistente',
        responsibleUserId: caller.id,
        dueOn: '2026-09-19',
      }),
    ).rejects.toThrow(NotFoundDomainError);
  });

  it('an Action of origin INDICATOR obeys the exact same transition table as any other Action — no origin-specific lifecycle (CLAUDE.md §19.6)', async () => {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('iao-transition-org'),
    });
    const owner = await setupActor(orgUnit.id, ['indicator:view']);
    const definition = await setupIndicatorDefinition(owner.id, owner.id);
    const actor = await setupActor(orgUnit.id, [
      'indicator:edit',
      'action:create',
      'action:edit',
      'action:view',
    ]);

    const { record: action } = await createActionUseCase.execute({
      actorUserId: actor.id,
      originType: 'INDICATOR',
      originId: definition.id,
      title: 'Corrigir causa do rompimento de limiar',
      responsibleUserId: actor.id,
      dueOn: '2026-09-19',
    });
    expect(action.status).toBe('OPEN');

    await expect(
      transitionActionUseCase.execute({
        actorUserId: actor.id,
        actionId: action.id,
        to: 'COMPLETED',
      }),
    ).rejects.toThrow(ValidationDomainError);

    const inProgress = await transitionActionUseCase.execute({
      actorUserId: actor.id,
      actionId: action.id,
      to: 'IN_PROGRESS',
    });
    expect(inProgress.status).toBe('IN_PROGRESS');

    const completed = await transitionActionUseCase.execute({
      actorUserId: actor.id,
      actionId: action.id,
      to: 'COMPLETED',
    });
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedByUserId).toBe(actor.id);

    await expect(
      transitionActionUseCase.execute({ actorUserId: actor.id, actionId: action.id, to: 'OPEN' }),
    ).rejects.toThrow(ValidationDomainError);

    const reopened = await transitionActionUseCase.execute({
      actorUserId: actor.id,
      actionId: action.id,
      to: 'OPEN',
      reason: 'Correção incompleta — reaberta para revisão adicional.',
    });
    expect(reopened.status).toBe('OPEN');
  });
});
