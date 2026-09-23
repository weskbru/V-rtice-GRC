import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActionModule } from '../../src/grc/action/action.module';
import { CreateActionUseCase } from '../../src/grc/action/application/create-action.usecase';
import { ListActionAuditEventsUseCase } from '../../src/grc/action/application/list-action-audit-events.usecase';
import { TransitionActionUseCase } from '../../src/grc/action/application/transition-action.usecase';
import { UpdateActionUseCase } from '../../src/grc/action/application/update-action.usecase';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { RiskModule } from '../../src/modules/risk/risk.module';
import { ForbiddenDomainError, NotFoundDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

describe('Action audit trail (GET /actions/{actionId}/audit-events), exercised against the real repository', () => {
  let ctx: IntegrationTestContext;
  let createRiskUseCase: CreateRiskUseCase;
  let createActionUseCase: CreateActionUseCase;
  let updateActionUseCase: UpdateActionUseCase;
  let transitionActionUseCase: TransitionActionUseCase;
  let listActionAuditEventsUseCase: ListActionAuditEventsUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, RiskModule, ActionModule],
    });
    createRiskUseCase = ctx.app.get(CreateRiskUseCase);
    createActionUseCase = ctx.app.get(CreateActionUseCase);
    updateActionUseCase = ctx.app.get(UpdateActionUseCase);
    transitionActionUseCase = ctx.app.get(TransitionActionUseCase);
    listActionAuditEventsUseCase = ctx.app.get(ListActionAuditEventsUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(
    permissions: readonly PermissionIdentifier[],
    orgUnitId: string,
  ): Promise<string> {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('action-audit-it-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-action-audit-it-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor.id;
  }

  async function setupRiskBackedAction(): Promise<{
    actorUserId: string;
    actionId: string;
    orgUnitId: string;
  }> {
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('action-audit-it-org'),
    });
    const actorUserId = await setupActor(
      [
        'action:create',
        'action:view',
        'action:edit',
        'audit:view',
        'risk:create',
        'risk:view',
        'risk:treat',
      ],
      orgUnit.id,
    );

    const risk = await createRiskUseCase.execute({
      actorUserId,
      title: 'Risco para trilha de auditoria da ação (integração)',
      description: 'Descrição do risco.',
      orgUnitId: orgUnit.id,
      ownerUserId: actorUserId,
    });

    const { record: action } = await createActionUseCase.execute({
      actorUserId,
      originType: 'RISK_TREATMENT',
      originId: risk.id,
      title: 'Corrigir a lacuna identificada (integração)',
      responsibleUserId: actorUserId,
      dueOn: '2035-03-01',
    });

    return { actorUserId, actionId: action.id, orgUnitId: orgUnit.id };
  }

  it('a trail assembled from creation, an edit and a transition contains all three events, read from the real repository', async () => {
    const { actorUserId, actionId } = await setupRiskBackedAction();

    await updateActionUseCase.execute({
      actorUserId,
      actionId,
      title: 'Corrigir a lacuna identificada (revisada)',
    });

    await transitionActionUseCase.execute({
      actorUserId,
      actionId,
      to: 'IN_PROGRESS',
    });

    const page = await listActionAuditEventsUseCase.execute({
      actorUserId,
      actionId,
      page: 1,
      pageSize: 50,
    });

    expect(page.total).toBe(page.items.length);
    const actionsSeen = page.items.map((item) => item.action);
    expect(actionsSeen).toContain('action.created');
    expect(actionsSeen).toContain('action.updated');
    expect(actionsSeen).toContain('action.started');
    expect(page.items.every((item) => item.entityType === 'ACTION')).toBe(true);
    expect(page.items.every((item) => item.entityId === actionId)).toBe(true);

    const occurredAtByAction = new Map(page.items.map((item) => [item.action, item.occurredAt]));
    expect(occurredAtByAction.get('action.started')!.getTime()).toBeGreaterThanOrEqual(
      occurredAtByAction.get('action.created')!.getTime(),
    );
  });

  it('the previousValues/newValues allow-listed fields are preserved verbatim for the field-edit event', async () => {
    const { actorUserId, actionId } = await setupRiskBackedAction();

    await updateActionUseCase.execute({
      actorUserId,
      actionId,
      title: 'Novo título para verificação de payload',
    });

    const page = await listActionAuditEventsUseCase.execute({
      actorUserId,
      actionId,
      page: 1,
      pageSize: 50,
    });

    const updated = page.items.find((item) => item.action === 'action.updated');
    expect(updated).toBeDefined();
    expect(updated!.newValues).toMatchObject({ title: 'Novo título para verificação de payload' });
  });

  it('a caller lacking action:view is refused with NotFoundDomainError — the audit:view gate is never reached', async () => {
    const { actionId } = await setupRiskBackedAction();
    const orgUnit = await createOrgUnitFixture(ctx.prisma, {
      code: uniqueTestMarker('action-audit-it-org-2'),
    });
    const outsiderId = await setupActor(['audit:view'], orgUnit.id);

    await expect(
      listActionAuditEventsUseCase.execute({
        actorUserId: outsiderId,
        actionId,
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toBeInstanceOf(NotFoundDomainError);
  });

  it('a caller holding action:view but not audit:view is refused with ForbiddenDomainError', async () => {
    const { actionId, orgUnitId } = await setupRiskBackedAction();
    const viewerId = await setupActor(['action:view'], orgUnitId);

    await expect(
      listActionAuditEventsUseCase.execute({
        actorUserId: viewerId,
        actionId,
        page: 1,
        pageSize: 25,
      }),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });
});
