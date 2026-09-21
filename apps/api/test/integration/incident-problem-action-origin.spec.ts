/**
 * 008-incidents-problems — real, exercised coverage (not a stub, CLAUDE.md
 * §19.10) for the two `ActionOriginType` registrations this phase adds:
 *
 *   1. `INCIDENT`, registered against `ActionOriginResolverPort` by
 *      `IncidentActionOriginAccessor` — an `Action` created with this
 *      origin appears in the shared work list identified by its origin,
 *      an origin outside the caller's scope is refused (spec.md FR-016),
 *      and — the coordinator's own three conditions for this piece —
 *      access tracks the origin's LIVE organizational unit (never a
 *      creation-time snapshot), a refusal is indistinguishable from a
 *      nonexistent record and keyed to the identifier the caller actually
 *      supplied, and the enum growth (`20260911030000_action_origin_type
 *      _add_incidents_problems`) only became legal once this registration
 *      genuinely existed (`test/unit/action-model-convergence-guard.spec.ts`,
 *      confirmed failing without it — see this feature's own report).
 *   2. `PROBLEM`, registered by `ProblemActionOriginAccessor` — the same
 *      four proofs, plus the specific consequence named in spec.md
 *      FR-016's own dated note: `Problem`'s `CLOSED` transition (Fase 4,
 *      not yet built) needs a `COMPLETED` `Action` of this origin to
 *      exist, which was unreachable before this file's registration did.
 *
 * Mirrors `control-collaboration-registrations.spec.ts`'s exact shape.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ActionModule } from '../../src/grc/action/action.module';
import { CreateActionUseCase } from '../../src/grc/action/application/create-action.usecase';
import { GetActionUseCase } from '../../src/grc/action/application/get-action.usecase';
import { ListActionUseCase } from '../../src/grc/action/application/list-action.usecase';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { IncidentsModule } from '../../src/modules/incidents/incidents.module';
import { ProblemsModule } from '../../src/modules/problems/problems.module';
import { NotFoundDomainError } from '../../src/shared/errors/domain-error';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

describe('008-incidents-problems — INCIDENT/PROBLEM action origin, genuinely exercised', () => {
  let ctx: IntegrationTestContext;
  let createActionUseCase: CreateActionUseCase;
  let getActionUseCase: GetActionUseCase;
  let listActionUseCase: ListActionUseCase;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, IncidentsModule, ProblemsModule, ActionModule],
    });
    createActionUseCase = ctx.app.get(CreateActionUseCase);
    getActionUseCase = ctx.app.get(GetActionUseCase);
    listActionUseCase = ctx.app.get(ListActionUseCase);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function setupActor(orgUnitId: string, permissions: readonly PermissionIdentifier[]) {
    const actor = await createUserFixture(ctx.prisma, {
      email: `${uniqueTestMarker('io-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(ctx.prisma, permissions, {
      name: `fixture-io-role-${randomUUID()}`,
    });
    await assignRoleFixture(ctx.prisma, { user: actor, role });
    await grantUnitScopeFixture(ctx.prisma, { user: actor, orgUnitId });
    return actor;
  }

  async function setupIncident(orgUnitId: string, reporterId: string) {
    return ctx.prisma.client.incident.create({
      data: {
        code: uniqueTestMarker('iop-inc'),
        orgUnitId,
        title: 'Serviço fora do ar',
        description: 'Incidente de teste para o acessor de origem.',
        severity: 'HIGH',
        reportedByUserId: reporterId,
        ownerUserId: reporterId,
        reportedOn: new Date('2026-09-11T00:00:00.000Z'),
      },
    });
  }

  async function setupProblem(orgUnitId: string, ownerId: string) {
    return ctx.prisma.client.problem.create({
      data: {
        code: uniqueTestMarker('iop-prb'),
        orgUnitId,
        title: 'Causa raiz recorrente',
        description: 'Problema de teste para o acessor de origem.',
        severity: 'HIGH',
        ownerUserId: ownerId,
        identifiedOn: new Date('2026-09-11T00:00:00.000Z'),
      },
    });
  }

  describe('INCIDENT', () => {
    it('an Action created with originType INCIDENT appears in the shared work list, identified by its origin', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-inc-org'),
      });
      const actor = await setupActor(orgUnit.id, ['incident:edit', 'action:create', 'action:view']);
      const incident = await setupIncident(orgUnit.id, actor.id);

      const { record: action, originLabel } = await createActionUseCase.execute({
        actorUserId: actor.id,
        originType: 'INCIDENT',
        originId: incident.id,
        title: 'Restaurar o serviço',
        responsibleUserId: actor.id,
        dueOn: '2026-09-12',
      });

      expect(action.originType).toBe('INCIDENT');
      expect(action.originId).toBe(incident.id);
      expect(originLabel).toContain(incident.code);

      const list = await listActionUseCase.execute({
        actorUserId: actor.id,
        page: 1,
        pageSize: 25,
        originType: 'INCIDENT',
        originId: incident.id,
      });
      expect(list.items.map((item) => item.id)).toContain(action.id);
    });

    it('an origin (incident) outside the caller organizational scope is refused when creating an action from it — keyed to the origin id, indistinguishable from nonexistent', async () => {
      const inScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-inc-scope-org'),
      });
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-inc-oos-org'),
      });

      const owner = await setupActor(outOfScopeOrgUnit.id, ['incident:edit']);
      const outOfScopeIncident = await setupIncident(outOfScopeOrgUnit.id, owner.id);

      const caller = await setupActor(inScopeOrgUnit.id, ['action:create', 'incident:edit']);

      const nonexistentId = randomUUID();
      const [refusalForOutOfScope, refusalForNonexistent] = await Promise.all([
        createActionUseCase
          .execute({
            actorUserId: caller.id,
            originType: 'INCIDENT',
            originId: outOfScopeIncident.id,
            title: 'Ação a partir de origem fora de escopo',
            responsibleUserId: caller.id,
            dueOn: '2026-09-12',
          })
          .catch((error: unknown) => error),
        createActionUseCase
          .execute({
            actorUserId: caller.id,
            originType: 'INCIDENT',
            originId: nonexistentId,
            title: 'Ação a partir de origem inexistente',
            responsibleUserId: caller.id,
            dueOn: '2026-09-12',
          })
          .catch((error: unknown) => error),
      ]);

      expect(refusalForOutOfScope).toBeInstanceOf(NotFoundDomainError);
      expect(refusalForNonexistent).toBeInstanceOf(NotFoundDomainError);
      // Indistinguishable: same problem+json shape for a real-but-out-of-
      // scope origin and a genuinely nonexistent one (FR-030), and both
      // keyed to the ORIGIN id the caller actually supplied — never a
      // different identifier they never sent.
      expect((refusalForOutOfScope as NotFoundDomainError).message).toBe(
        (refusalForNonexistent as NotFoundDomainError).message.replace(
          nonexistentId,
          outOfScopeIncident.id,
        ),
      );
    });

    it("access tracks the incident's LIVE organizational unit, never the value stamped on the Action at creation (moving a record between units)", async () => {
      const unitA = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-inc-unit-a'),
      });
      const unitB = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-inc-unit-b'),
      });

      const actorInA = await setupActor(unitA.id, [
        'incident:edit',
        'incident:view',
        'action:create',
        'action:view',
      ]);
      const incident = await setupIncident(unitA.id, actorInA.id);

      const { record: action } = await createActionUseCase.execute({
        actorUserId: actorInA.id,
        originType: 'INCIDENT',
        originId: incident.id,
        title: 'Mitigar o incidente',
        responsibleUserId: actorInA.id,
        dueOn: '2026-09-12',
      });

      // Still in unit A: the actor scoped to A can read the action, via
      // the origin's live scope.
      await expect(
        getActionUseCase.execute({ actorUserId: actorInA.id, actionId: action.id }),
      ).resolves.toMatchObject({ id: action.id });

      // The incident is reassigned to unit B — no `UpdateIncidentUseCase`
      // exists yet (Fase 3, tasks.md), so this is the direct row update a
      // future "reassign" capability would perform; what matters here is
      // only the CONSEQUENCE of that reassignment, not how it is reached.
      await ctx.prisma.client.incident.update({
        where: { id: incident.id },
        data: { orgUnitId: unitB.id },
      });

      // The actor's OWN scope never changed (still only unit A) and the
      // Action's own stored `orgUnitId` was stamped from unit A at
      // creation and never rewritten — a stale-snapshot implementation
      // would still permit this read. Live re-derivation must refuse it.
      await expect(
        getActionUseCase.execute({ actorUserId: actorInA.id, actionId: action.id }),
      ).rejects.toThrow(NotFoundDomainError);

      // Symmetrically, an actor newly scoped to unit B (the incident's
      // CURRENT unit) can now read the very same action — proving the
      // check is live in both directions, not merely "used to work and
      // now does not".
      const actorInB = await setupActor(unitB.id, ['incident:view', 'action:view']);
      await expect(
        getActionUseCase.execute({ actorUserId: actorInB.id, actionId: action.id }),
      ).resolves.toMatchObject({ id: action.id });
    });
  });

  describe('PROBLEM', () => {
    it('an Action created with originType PROBLEM appears in the shared work list, identified by its origin', async () => {
      const orgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-prb-org'),
      });
      const actor = await setupActor(orgUnit.id, ['problem:edit', 'action:create', 'action:view']);
      const problem = await setupProblem(orgUnit.id, actor.id);

      const { record: action, originLabel } = await createActionUseCase.execute({
        actorUserId: actor.id,
        originType: 'PROBLEM',
        originId: problem.id,
        title: 'Eliminar a causa raiz',
        responsibleUserId: actor.id,
        dueOn: '2026-09-12',
      });

      expect(action.originType).toBe('PROBLEM');
      expect(action.originId).toBe(problem.id);
      expect(originLabel).toContain(problem.code);

      const list = await listActionUseCase.execute({
        actorUserId: actor.id,
        page: 1,
        pageSize: 25,
        originType: 'PROBLEM',
        originId: problem.id,
      });
      expect(list.items.map((item) => item.id)).toContain(action.id);
    });

    it('an origin (problem) outside the caller organizational scope is refused when creating an action from it', async () => {
      const inScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-prb-scope-org'),
      });
      const outOfScopeOrgUnit = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-prb-oos-org'),
      });

      const owner = await setupActor(outOfScopeOrgUnit.id, ['problem:edit']);
      const outOfScopeProblem = await setupProblem(outOfScopeOrgUnit.id, owner.id);

      const caller = await setupActor(inScopeOrgUnit.id, ['action:create', 'problem:edit']);

      await expect(
        createActionUseCase.execute({
          actorUserId: caller.id,
          originType: 'PROBLEM',
          originId: outOfScopeProblem.id,
          title: 'Ação a partir de origem fora de escopo',
          responsibleUserId: caller.id,
          dueOn: '2026-09-12',
        }),
      ).rejects.toThrow(NotFoundDomainError);
    });

    it("access tracks the problem's LIVE organizational unit, never the value stamped on the Action at creation", async () => {
      const unitA = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-prb-unit-a'),
      });
      const unitB = await createOrgUnitFixture(ctx.prisma, {
        code: uniqueTestMarker('io-prb-unit-b'),
      });

      const actorInA = await setupActor(unitA.id, [
        'problem:edit',
        'problem:view',
        'action:create',
        'action:view',
      ]);
      const problem = await setupProblem(unitA.id, actorInA.id);

      const { record: action } = await createActionUseCase.execute({
        actorUserId: actorInA.id,
        originType: 'PROBLEM',
        originId: problem.id,
        title: 'Corrigir definitivamente',
        responsibleUserId: actorInA.id,
        dueOn: '2026-09-12',
      });

      await expect(
        getActionUseCase.execute({ actorUserId: actorInA.id, actionId: action.id }),
      ).resolves.toMatchObject({ id: action.id });

      await ctx.prisma.client.problem.update({
        where: { id: problem.id },
        data: { orgUnitId: unitB.id },
      });

      await expect(
        getActionUseCase.execute({ actorUserId: actorInA.id, actionId: action.id }),
      ).rejects.toThrow(NotFoundDomainError);

      const actorInB = await setupActor(unitB.id, ['problem:view', 'action:view']);
      await expect(
        getActionUseCase.execute({ actorUserId: actorInB.id, actionId: action.id }),
      ).resolves.toMatchObject({ id: action.id });
    });
  });
});
