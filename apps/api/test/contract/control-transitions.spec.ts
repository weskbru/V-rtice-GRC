/**
 * T024/T025/003-controls-management, User Story 1 — contract coverage for
 * the lifecycle operations of `contracts/controls.openapi.yaml`
 * (operations 5-6 of 6: `getControlLifecycle`, `transitionControl`, D-6,
 * FR-004, FR-005, FR-006).
 *
 * Exercises EVERY declared transition at least once — no state is
 * declared-but-unreachable (research.md D-6's own account of the
 * `FindingStatus` defect this phase deliberately avoids repeating):
 *
 *   DRAFT -> ACTIVE (requires owner)      DRAFT -> RETIRED (requires justification)
 *   ACTIVE -> SUSPENDED                   ACTIVE -> RETIRED
 *   SUSPENDED -> ACTIVE                   SUSPENDED -> RETIRED
 *
 * Uses `buildControlsContractTestApp` — see `control-catalog.spec.ts`'s
 * header for why (this task does not own `controls.module.ts`).
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { formatETag } from '../../src/modules/controls/presentation/control.controller';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildControlsContractTestApp } from './support/controls-contract-app';

import type { ContractTestContext } from './support/contract-app';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ControlDetailBody {
  readonly id: string;
  readonly status: string;
  readonly owner: { readonly id: string } | null;
  readonly isActive: boolean;
  readonly retiredAt: string | null;
  readonly retirementReason: string | null;
  readonly version: number;
}

interface AvailableTransitionBody {
  readonly toStatus: string;
  readonly requiredPermission: string;
  readonly preconditionsMet: boolean;
  readonly unmetPreconditions: readonly string[];
}

interface LifecycleStateBody {
  readonly status: string;
  readonly availableTransitions: readonly AvailableTransitionBody[];
}

interface TransitionResponseBody {
  readonly id: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly justification: string | null;
}

describe('Control lifecycle (US1, operations 5-6, D-6)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('control-lifecycle-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-control-lifecycle-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return { agent, userId: fixture.user.id };
  }

  async function createControl(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string }> {
    const response = await agent
      .post('/api/v1/controls')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('control-lifecycle-subject'),
        description: 'Descrição do controle.',
        orgUnitId,
        ...overrides,
      });
    expect(response.status).toBe(201);
    const body = response.body as { id: string };
    return { id: body.id, version: response.headers.etag! };
  }

  beforeAll(async () => {
    ctx = await buildControlsContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('control-lifecycle'),
    });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /controls/{controlId}/lifecycle (getControlLifecycle)', () => {
    it('a fresh DRAFT control offers ACTIVE (unmet: no owner) and RETIRED (unmet: no justification) to a caller holding both permissions', async () => {
      const { agent } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
        'control:administer',
      ]);
      const { id } = await createControl(agent);

      const response = await agent.get(`/api/v1/controls/${id}/lifecycle`).set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const body = response.body as LifecycleStateBody;
      expect(body.status).toBe('DRAFT');
      const targets = body.availableTransitions.map((t) => t.toStatus).sort();
      expect(targets).toEqual(['ACTIVE', 'RETIRED']);

      const toActive = body.availableTransitions.find((t) => t.toStatus === 'ACTIVE')!;
      expect(toActive.preconditionsMet).toBe(false);
      expect(toActive.unmetPreconditions.length).toBeGreaterThan(0);

      const toRetired = body.availableTransitions.find((t) => t.toStatus === 'RETIRED')!;
      expect(toRetired.preconditionsMet).toBe(false);
    });

    it('offers only transitions permitted to the caller — a control:edit-only caller never sees RETIRED (control:administer)', async () => {
      const creator = await agentWithPermissions(['control:create']);
      const { id } = await createControl(creator.agent);
      const { agent } = await agentWithPermissions(['control:view', 'control:edit']);

      const response = await agent.get(`/api/v1/controls/${id}/lifecycle`).set('Origin', appOrigin);

      const body = response.body as LifecycleStateBody;
      expect(body.availableTransitions.map((t) => t.toStatus)).toEqual(['ACTIVE']);
    });

    it('RETIRED offers no outgoing transitions — terminal (D-6)', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });

      const retireResponse = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'RETIRED', justification: 'Descontinuado para teste.' });
      expect(retireResponse.status).toBe(200);

      const lifecycle = await agent
        .get(`/api/v1/controls/${id}/lifecycle`)
        .set('Origin', appOrigin);
      const body = lifecycle.body as LifecycleStateBody;
      expect(body.status).toBe('RETIRED');
      expect(body.availableTransitions).toEqual([]);
    });
  });

  describe('POST /controls/{controlId}/transitions (transitionControl)', () => {
    it('DRAFT -> ACTIVE requires an owner — refused with 422 when absent, succeeds once assigned (FR-005)', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const { id, version } = await createControl(agent);

      const refused = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });
      expect(refused.status).toBe(422);

      await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ ownerUserId: userId });
      const afterOwner = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      // `GET /controls/{id}` carries no `ETag` (`ControlController.findById`'s
      // own doc comment — `effectiveness` is derived at read time and
      // must never be presented as version-scoped freshness), so the next
      // `If-Match` is built from the body's own `version` instead, exactly
      // like the frontend's `resolveEtag` fallback does.
      const currentVersion = formatETag((afterOwner.body as ControlDetailBody).version);

      const activated = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', currentVersion)
        .send({ toStatus: 'ACTIVE' });
      expect(activated.status).toBe(200);
      const body = activated.body as TransitionResponseBody;
      expect(body.fromStatus).toBe('DRAFT');
      expect(body.toStatus).toBe('ACTIVE');

      // Observable consequence of ACTIVE: is_active reads true through the
      // detail response's derived fields — the control is now genuinely
      // "in operation".
      const detail = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      expect((detail.body as ControlDetailBody).status).toBe('ACTIVE');
    });

    it('ACTIVE <-> SUSPENDED round-trips, preserving the control (edge case "reativação de controle suspenso")', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });

      await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });

      // `GET /controls/{id}` carries no `ETag` (`ControlController.findById`'s
      // own doc comment) — `If-Match` for the next transition is built
      // from the body's own `version`, exactly like the frontend's
      // `resolveEtag` fallback does.
      const afterActivate = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      const suspended = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', formatETag((afterActivate.body as ControlDetailBody).version))
        .send({ toStatus: 'SUSPENDED' });
      expect(suspended.status).toBe(200);
      expect((suspended.body as TransitionResponseBody).toStatus).toBe('SUSPENDED');

      const afterSuspend = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      const reactivated = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', formatETag((afterSuspend.body as ControlDetailBody).version))
        .send({ toStatus: 'ACTIVE' });
      expect(reactivated.status).toBe(200);
      expect((reactivated.body as TransitionResponseBody).toStatus).toBe('ACTIVE');
    });

    it('entering RETIRED requires justification — refused with 422 when absent (US1 AS3)', async () => {
      const { agent } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent);

      const refused = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'RETIRED' });
      expect(refused.status).toBe(422);
    });

    it('DRAFT -> RETIRED is reachable — a control with no owner can still be discontinued (FR-006, the D-6 unreachable-state fix)', async () => {
      const { agent } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent);

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'RETIRED', justification: 'Cadastrado por engano.' });

      expect(response.status).toBe(200);
      const detail = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      const body = detail.body as ControlDetailBody;
      expect(body.status).toBe('RETIRED');
      expect(body.isActive).toBe(false);
      expect(body.retiredAt).not.toBeNull();
      expect(body.retirementReason).toBe('Cadastrado por engano.');
    });

    it('ACTIVE -> RETIRED is reachable directly, without passing through SUSPENDED', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });
      const activated = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', activated.headers.etag!)
        .send({ toStatus: 'RETIRED', justification: 'Substituído por outro controle.' });

      expect(response.status).toBe(200);
      expect((response.body as TransitionResponseBody).fromStatus).toBe('ACTIVE');
    });

    it('SUSPENDED -> RETIRED is reachable', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });
      const activated = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });
      const suspended = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', activated.headers.etag!)
        .send({ toStatus: 'SUSPENDED' });

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', suspended.headers.etag!)
        .send({ toStatus: 'RETIRED', justification: 'Descontinuado enquanto suspenso.' });

      expect(response.status).toBe(200);
      expect((response.body as TransitionResponseBody).fromStatus).toBe('SUSPENDED');
    });

    it('a RETIRED control rejects any further transition — 422', async () => {
      const { agent } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:administer',
      ]);
      const { id, version } = await createControl(agent);
      const retired = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'RETIRED', justification: 'Encerrado.' });
      const retiredEtag = retired.headers.etag!;

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', retiredEtag)
        .send({ toStatus: 'ACTIVE' });
      expect(response.status).toBe(422);
    });

    it('the terminal RETIRED transition requires control:administer — control:edit alone is refused with 403', async () => {
      const creator = await agentWithPermissions(['control:create']);
      const { id, version } = await createControl(creator.agent);
      const { agent } = await agentWithPermissions(['control:view', 'control:edit']);

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'RETIRED', justification: 'Tentativa sem permissão.' });
      expect(response.status).toBe(403);
    });

    it('a pair absent from the transition table is refused with 422 (e.g. ACTIVE -> DRAFT)', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });
      const activated = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', activated.headers.etag!)
        .send({ toStatus: 'DRAFT' });
      expect(response.status).toBe(422);
    });

    it('a stale If-Match on a transition yields 409 with the current version, and the transition is not applied', async () => {
      const { agent, userId } = await agentWithPermissions([
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const { id, version } = await createControl(agent, { ownerUserId: userId });

      await agent
        .patch(`/api/v1/controls/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Nome alterado antes da transição' });

      const response = await agent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });
      expect(response.status).toBe(409);

      const detail = await agent.get(`/api/v1/controls/${id}`).set('Origin', appOrigin);
      expect((detail.body as ControlDetailBody).status).toBe('DRAFT');
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/controls/${randomUUID()}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ toStatus: 'ACTIVE' });
      expect(response.status).toBe(401);
    });

    it('a control outside the caller scope answers 404, not 422/403', async () => {
      const creator = await agentWithPermissions(['control:create']);
      const { id, version } = await createControl(creator.agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('control-lifecycle-other-unit'),
      });
      const prisma = ctx.app.get(PrismaService);
      const fixture = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('control-lifecycle-outside')}@example.test`,
        primaryOrgUnitId: otherUnit.id,
      });
      const role = await createRoleWithPermissionsFixture(
        prisma,
        ['control:view', 'control:edit'],
        { name: `fixture-control-lifecycle-outside-role-${randomUUID()}` },
      );
      await assignRoleFixture(prisma, { user: fixture.user, role });
      await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: otherUnit.id });
      const outsideAgent = request.agent(ctx.app.getHttpServer());
      await outsideAgent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: fixture.user.email, password: fixture.rawPassword });

      const response = await outsideAgent
        .post(`/api/v1/controls/${id}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ toStatus: 'ACTIVE' });
      expect(response.status).toBe(404);
    });
  });
});
