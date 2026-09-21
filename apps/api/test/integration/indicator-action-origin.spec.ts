/**
 * 009-indicators-reports, Fase 6 (T046, US4) — real, exercised coverage
 * (not a stub, CLAUDE.md §19.10) for `ActionOriginType.INDICATOR`,
 * registered against `ActionOriginResolverPort` by
 * `IndicatorActionOriginAccessor` (`indicator-action-origin-accessor.ts`).
 * Mirrors `incident-problem-action-origin.spec.ts`'s exact shape (see that
 * file's header for the four proofs it already establishes for
 * INCIDENT/PROBLEM), with ONE deliberate divergence this file exists to
 * prove:
 *
 *   `IndicatorDefinition` is organization-wide (research.md D-8, spec.md
 *   FR-021) — unlike INCIDENT/PROBLEM, a caller whose organizational scope
 *   does NOT cover the indicator owner's unit still creates/reads/lists an
 *   `Action` of this origin successfully, as long as they hold
 *   `indicator:view`/`indicator:edit`. This file's second `it` block is the
 *   photo-negative of `incident-problem-action-origin.spec.ts`'s own
 *   out-of-scope refusal test.
 *
 * Also proves US4's own "no separate lifecycle" requirement (CLAUDE.md
 * §19.6): an `Action` of origin `INDICATOR` transitions through the exact
 * same `TransitionActionUseCase`/transition table as any other `Action` —
 * no indicator-specific status, no bespoke completion rule.
 *
 * Finally, proves the enum growth
 * (`20260912000000_action_origin_type_add_indicator`) only became legal
 * once this registration genuinely exists
 * (`test/unit/action-model-convergence-guard.spec.ts`, confirmed failing
 * without it by direct removal-and-revert experiment — see this task's own
 * report, not restated as an automated test here: the guard itself already
 * is that automated test, run against the registration this file exercises
 * for real).
 */
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

/**
 * `metric_key` is `UNIQUE` on `indicator_definitions`, and this suite
 * shares one real database across every integration spec file
 * (`vitest.integration.config.ts`: `fileParallelism: false`, no per-file
 * reset). `indicator-measurements.spec.ts`/
 * `indicator-measurement-notifications.spec.ts` already own
 * `ASSET_INACTIVE_COUNT`/`CONTROL_INACTIVE_COUNT`/`PROCESS_INACTIVE_COUNT`
 * for their own fixtures — this list deliberately avoids those three, and
 * probes each candidate for an existing row (rather than assuming the
 * first is free) so this file does not itself become a fourth silent
 * collision the next agent has to debug.
 */
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

  /** Picks the first metric key in `CANDIDATE_METRIC_KEYS` with no
   * `IndicatorDefinition` row yet, and creates one owned by `ownerId` —
   * this file's own header explains why this probes rather than assumes.
   */
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
    // `Action.orgUnitId` (NOT NULL) was stamped from the DEFINITION
    // OWNER's own current unit (research.md D-8 — the indicator itself has
    // none) — this class's own header, not a value the caller supplied.
    expect(action.orgUnit.id).toBe(ownerOrgUnit.id);

    // Appears in the shared work list, identified by its origin.
    const byOrigin = await listActionUseCase.execute({
      actorUserId: actor.id,
      page: 1,
      pageSize: 25,
      originType: 'INDICATOR',
      originId: definition.id,
    });
    expect(byOrigin.items.map((item) => item.id)).toContain(action.id);

    // "Minhas ações" — filtered by responsibleUserId, the same shared
    // register every other origin type already uses (SC-002).
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

    // Deliberately a DIFFERENT unit than the indicator owner's — an
    // INCIDENT/PROBLEM-origin Action would refuse this caller
    // (`incident-problem-action-origin.spec.ts`'s own out-of-scope test).
    // An INDICATOR-origin one must not: FR-021's "toda IndicatorDefinition
    // [é] visível a qualquer chamador com indicator:view", reflected in
    // `IndicatorActionOriginAccessor#resolveOriginScope`/
    // `#listOriginIdsInScope` never checking containment at all.
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

    // Reads it back — the origin-scope re-check
    // (`assertActionOriginInScope`) must not refuse this caller either.
    await expect(
      getActionUseCase.execute({ actorUserId: caller.id, actionId: action.id }),
    ).resolves.toMatchObject({ id: action.id });

    // And a SECOND caller, scoped to yet another, still-different unit,
    // can see it too via the list restriction
    // (`ListActionUseCase#resolveOriginScopeRestriction` ->
    // `listOriginIdsInScope`) — proving the org-wide behaviour is not an
    // accident of the first caller's own grant.
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

    // OPEN -> COMPLETED directly is illegal for EVERY Action, regardless
    // of origin (data-model.md §4's own diagram) — the SAME
    // `ValidationDomainError` any other origin type's Action would throw,
    // never a bespoke indicator rule.
    await expect(
      transitionActionUseCase.execute({
        actorUserId: actor.id,
        actionId: action.id,
        to: 'COMPLETED',
      }),
    ).rejects.toThrow(ValidationDomainError);

    // The legal path: OPEN -> IN_PROGRESS -> COMPLETED.
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

    // Reopening (COMPLETED -> OPEN) requires a reason — Invariant A2,
    // generic to every Action.
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
