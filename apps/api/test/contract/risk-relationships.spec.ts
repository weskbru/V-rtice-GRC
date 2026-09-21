/**
 * D-11 coverage for every "Risk Relationships" and registry endpoint this
 * dispatch adds (T142/T143, FR-076, FR-077): the stated authorization rule
 * (including a caller lacking it refused, and — for the registries — a
 * zero-permission-beyond-risk:view caller genuinely succeeding), 401 for an
 * unauthenticated caller, and the declared response shape. Controls are
 * gated by `risk:treat`; processes and assets are gated by `risk:edit` —
 * distinct permissions per the contract, both exercised here.
 */
import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantUnitScopeFixture,
  makeRiskAssignmentVisible,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  createUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
}

interface RiskDetailBody {
  readonly id: string;
}

interface RegistryRefBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface ControlLinkBody {
  readonly id: string;
  readonly control: RegistryRefBody;
  readonly linkedBy: { readonly id: string };
  readonly linkedAt: string;
  readonly unlinkedBy: { readonly id: string } | null;
  readonly unlinkedAt: string | null;
}

interface EntityLinkBody {
  readonly id: string;
  readonly entity: RegistryRefBody;
  readonly linkedBy: { readonly id: string };
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

interface RegistryItemBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isActive: boolean;
}

interface RegistryPageBody {
  readonly data: readonly RegistryItemBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('Risk Relationships and registry endpoints (T142, T143, FR-076, FR-077, D-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('risk-relationship-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-relationship-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
    // F-CV-2: precondition owner — not the object of any assertion here.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<{ agent: ReturnType<typeof request.agent> }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('risk-relationship-actor')}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-risk-relationship-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent };
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ id: string; version: string }> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para testes de relacionamento',
      description: 'Descrição do risco.',
      orgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    const body = response.body as RiskDetailBody;
    return { id: body.id, version: response.headers.etag! };
  }

  // F-46 (ADR-020 part 4, `docs/deferred-findings.md`) — `LinkControlUseCase`
  // now refuses a control outside the actor's organizational scope. Every
  // agent this file creates (`agentWithPermissions`) is granted UNIT scope
  // over the shared `orgUnitId` (`beforeAll`), so this fixture creates the
  // control there too — omitting `orgUnitId` (defaulting to `null`) would
  // now be out of scope for a UNIT-scoped actor and every "succeeds" test
  // below would be refused by the very check this fix adds.
  async function createControl(): Promise<{ id: string; code: string; name: string }> {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.control.create({
      data: {
        code: uniqueTestMarker('control'),
        name: 'Controle de teste',
        orgUnitId,
        isActive: true,
      },
    });
  }

  // T034/T035 (006-assets-processes, FR-011, ADR-020 part 4) —
  // `LinkAssetUseCase`/`LinkProcessUseCase` now refuse a target outside the
  // actor's organizational scope. Every agent this file creates
  // (`agentWithPermissions`) is granted UNIT scope over the shared
  // `orgUnitId` (`beforeAll`), so — mirroring `createControl`'s own comment
  // above, added for the identical reason by F-46 — these fixtures create
  // the process/asset there too — omitting `orgUnitId` (defaulting to
  // `null`) would now be out of scope for a UNIT-scoped actor and every
  // "succeeds" test below would be refused by the very check this fix adds.
  async function createProcess(): Promise<{ id: string; code: string; name: string }> {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.process.create({
      data: {
        code: uniqueTestMarker('process'),
        name: 'Processo de teste',
        orgUnitId,
        isActive: true,
      },
    });
  }

  async function createAsset(): Promise<{ id: string; code: string; name: string }> {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.asset.create({
      data: {
        code: uniqueTestMarker('asset'),
        name: 'Ativo de teste',
        orgUnitId,
        isActive: true,
      },
    });
  }

  // -------------------------------------------------------------------
  // Controls — risk:treat
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/controls', () => {
    it('succeeds for a caller holding risk:treat and returns the declared RiskControlLink shape', async () => {
      // ADR-020 part 5 — linking a control now also requires `control:view`
      // on the referenced control, not only `risk:treat`.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
        'control:view',
      ]);
      const { id, version } = await createRisk(agent);
      const control = await createControl();

      const response = await agent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });

      expect(response.status).toBe(201);
      expect(response.headers.etag).toBeDefined();
      const body = response.body as ControlLinkBody;
      expect(body.id).toBeTruthy();
      expect(body.control).toEqual({ id: control.id, code: control.code, name: control.name });
      expect(body.linkedBy.id).toBeTruthy();
      expect(body.linkedAt).toBeTruthy();
      expect(body.unlinkedAt).toBeNull();
      expect(body.unlinkedBy).toBeNull();
    });

    it('refuses a caller lacking risk:treat — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const control = await createControl();

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ id: randomUUID() });
      expect(response.status).toBe(401);
      const body = response.body as ProblemBody;
      expect(body.status).toBe(401);
    });

    it('returns 409 (type=conflict) when the control is already linked', async () => {
      // ADR-020 part 5 — linking a control now also requires `control:view`
      // on the referenced control, not only `risk:treat`.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
        'control:view',
      ]);
      const { id, version } = await createRisk(agent);
      const control = await createControl();

      const first = await agent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });
      expect(first.status).toBe(201);

      const second = await agent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', first.headers.etag!)
        .send({ id: control.id });

      expect(second.status).toBe(409);
    });
  });

  describe('GET /risks/{riskId}/controls', () => {
    it('succeeds for a caller holding ONLY risk:view and returns a plain array (not a paginated envelope)', async () => {
      // ADR-020 part 5 — linking a control now also requires `control:view`
      // on the referenced control, not only `risk:treat`.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
        'control:view',
      ]);
      const { id, version } = await createRisk(agent);
      const control = await createControl();
      const linkResponse = await agent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });
      expect(linkResponse.status).toBe(201);

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .get(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      const body = response.body as readonly ControlLinkBody[];
      expect(body).toHaveLength(1);
      expect(body[0]!.control.id).toBe(control.id);
    });

    it('refuses a caller lacking risk:view — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
      ]);
      const { id } = await createRisk(creatorAgent);

      const { agent: bareAgent } = await agentWithPermissions([]);
      const response = await bareAgent.get(`/api/v1/risks/${id}/controls`).set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/risks/${randomUUID()}/controls`,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /risks/{riskId}/controls/{linkId}', () => {
    it('succeeds for a caller holding risk:treat, withdraws the link and returns 204', async () => {
      // ADR-020 part 5 — linking a control now also requires `control:view`
      // on the referenced control, not only `risk:treat`.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
        'control:view',
      ]);
      const { id, version } = await createRisk(agent);
      const control = await createControl();
      const linkResponse = await agent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });
      const link = linkResponse.body as ControlLinkBody;

      const response = await agent
        .delete(`/api/v1/risks/${id}/controls/${link.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', linkResponse.headers.etag!);

      expect(response.status).toBe(204);
      expect(response.headers.etag).toBeDefined();
    });

    it('refuses a caller lacking risk:treat — 403', async () => {
      // ADR-020 part 5 — this fixture's `creatorAgent` links a control
      // before the DELETE is attempted, which now also requires
      // `control:view` on the referenced control.
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:treat',
        'control:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const control = await createControl();
      const linkResponse = await creatorAgent
        .post(`/api/v1/risks/${id}/controls`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: control.id });
      const link = linkResponse.body as ControlLinkBody;

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .delete(`/api/v1/risks/${id}/controls/${link.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', linkResponse.headers.etag!);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/risks/${randomUUID()}/controls/${randomUUID()}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"');
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Processes — risk:edit
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/processes', () => {
    it('succeeds for a caller holding risk:edit and process:view, and returns the declared RiskEntityLink shape', async () => {
      // FR-011 (006-assets-processes) — creating this link now also
      // requires `process:view` on the referenced process, not only
      // `risk:edit` (ADR-020 part 5). This test used to grant only
      // `risk:edit`; updated to cite the requirement it now exercises.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(agent);
      const process = await createProcess();

      const response = await agent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: process.id });

      expect(response.status).toBe(201);
      expect(response.headers.etag).toBeDefined();
      const body = response.body as EntityLinkBody;
      expect(body.entity).toEqual({ id: process.id, code: process.code, name: process.name });
      expect(body.unlinkedAt).toBeNull();
    });

    it('refuses a caller holding risk:treat but NOT risk:edit — 403 (distinct permission)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const process = await createProcess();

      const { agent: treatOnlyAgent } = await agentWithPermissions(['risk:view', 'risk:treat']);
      const response = await treatOnlyAgent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: process.id });

      expect(response.status).toBe(403);
    });

    // FR-011, T038 (006-assets-processes, ADR-020 part 5) — a caller with
    // link authority (`risk:edit`) but WITHOUT `process:view` is refused:
    // authority is required on both sides of the link, never one alone.
    it('T038: refuses a caller holding risk:edit but NOT process:view — the referenced side is also required (ADR-020 part 5, FR-011)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const process = await createProcess();

      const { agent: editOnlyAgent } = await agentWithPermissions(['risk:view', 'risk:edit']);
      const response = await editOnlyAgent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: process.id });

      expect(response.status).toBe(422);
    });

    // T037 (006-assets-processes, SC-003, FR-010, FR-011) — a process
    // outside the actor's organizational scope answers exactly as a
    // nonexistent one, and no row is written. This is the defect the spec
    // measures as open for this pair; the equivalent for
    // `POST /risks/{riskId}/controls` already passes today (F-46).
    it('T037: refuses a process outside the actor organizational scope exactly as a nonexistent one, and writes no row', async () => {
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(agent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-out-of-scope'),
      });
      const outOfScopeProcess = await ctx.app.get(PrismaService).client.process.create({
        data: {
          code: uniqueTestMarker('process-oos'),
          name: 'Processo fora do escopo',
          orgUnitId: otherUnit.id,
          isActive: true,
        },
      });

      const nonexistentResponse = await agent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: randomUUID() });

      const outOfScopeResponse = await agent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: outOfScopeProcess.id });

      expect(outOfScopeResponse.status).toBe(nonexistentResponse.status);
      expect((outOfScopeResponse.body as ProblemBody).status).toBe(
        (nonexistentResponse.body as ProblemBody).status,
      );

      const links = await ctx.app.get(PrismaService).client.riskProcessLink.findMany({
        where: { riskId: id, processId: outOfScopeProcess.id },
      });
      expect(links).toHaveLength(0);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ id: randomUUID() });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /risks/{riskId}/processes/{linkId}', () => {
    it('succeeds for a caller holding risk:edit and returns 204', async () => {
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(agent);
      const process = await createProcess();
      const linkResponse = await agent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: process.id });
      const link = linkResponse.body as EntityLinkBody;

      const response = await agent
        .delete(`/api/v1/risks/${id}/processes/${link.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', linkResponse.headers.etag!);

      expect(response.status).toBe(204);
    });

    it('refuses a caller lacking risk:edit — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'process:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const process = await createProcess();
      const linkResponse = await creatorAgent
        .post(`/api/v1/risks/${id}/processes`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: process.id });
      const link = linkResponse.body as EntityLinkBody;

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .delete(`/api/v1/risks/${id}/processes/${link.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', linkResponse.headers.etag!);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/risks/${randomUUID()}/processes/${randomUUID()}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"');
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Assets — risk:edit
  // -------------------------------------------------------------------

  describe('POST /risks/{riskId}/assets', () => {
    it('succeeds for a caller holding risk:edit and asset:view, and returns the declared RiskEntityLink shape', async () => {
      // FR-011 (006-assets-processes) — creating this link now also
      // requires `asset:view` on the referenced asset, not only
      // `risk:edit` (ADR-020 part 5). This test used to grant only
      // `risk:edit`; updated to cite the requirement it now exercises.
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'asset:view',
      ]);
      const { id, version } = await createRisk(agent);
      const asset = await createAsset();

      const response = await agent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: asset.id });

      expect(response.status).toBe(201);
      const body = response.body as EntityLinkBody;
      expect(body.entity).toEqual({ id: asset.id, code: asset.code, name: asset.name });
      expect(body.unlinkedAt).toBeNull();
    });

    it('refuses a caller lacking risk:edit — 403', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'asset:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const asset = await createAsset();

      const { agent: viewerAgent } = await agentWithPermissions(['risk:view']);
      const response = await viewerAgent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: asset.id });

      expect(response.status).toBe(403);
    });

    // FR-011, T038 (006-assets-processes, ADR-020 part 5) — a caller with
    // link authority (`risk:edit`) but WITHOUT `asset:view` is refused:
    // authority is required on both sides of the link, never one alone.
    it('T038: refuses a caller holding risk:edit but NOT asset:view — the referenced side is also required (ADR-020 part 5, FR-011)', async () => {
      const { agent: creatorAgent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'asset:view',
      ]);
      const { id, version } = await createRisk(creatorAgent);
      const asset = await createAsset();

      const { agent: editOnlyAgent } = await agentWithPermissions(['risk:view', 'risk:edit']);
      const response = await editOnlyAgent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: asset.id });

      expect(response.status).toBe(422);
    });

    // T037 (006-assets-processes, SC-003, FR-010, FR-011) — an asset
    // outside the actor's organizational scope answers exactly as a
    // nonexistent one, and no row is written. This is the defect the spec
    // measures as open for this pair; the equivalent for
    // `POST /risks/{riskId}/controls` already passes today (F-46).
    it('T037: refuses an asset outside the actor organizational scope exactly as a nonexistent one, and writes no row', async () => {
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'asset:view',
      ]);
      const { id, version } = await createRisk(agent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('asset-out-of-scope'),
      });
      const outOfScopeAsset = await ctx.app.get(PrismaService).client.asset.create({
        data: {
          code: uniqueTestMarker('asset-oos'),
          name: 'Ativo fora do escopo',
          orgUnitId: otherUnit.id,
          isActive: true,
        },
      });

      const nonexistentResponse = await agent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: randomUUID() });

      const outOfScopeResponse = await agent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: outOfScopeAsset.id });

      expect(outOfScopeResponse.status).toBe(nonexistentResponse.status);
      expect((outOfScopeResponse.body as ProblemBody).status).toBe(
        (nonexistentResponse.body as ProblemBody).status,
      );

      const links = await ctx.app.get(PrismaService).client.riskAssetLink.findMany({
        where: { riskId: id, assetId: outOfScopeAsset.id },
      });
      expect(links).toHaveLength(0);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/api/v1/risks/${randomUUID()}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"')
        .send({ id: randomUUID() });
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /risks/{riskId}/assets/{linkId}', () => {
    it('succeeds for a caller holding risk:edit and returns 204', async () => {
      const { agent } = await agentWithPermissions([
        'risk:create',
        'risk:view',
        'risk:edit',
        'asset:view',
      ]);
      const { id, version } = await createRisk(agent);
      const asset = await createAsset();
      const linkResponse = await agent
        .post(`/api/v1/risks/${id}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ id: asset.id });
      const link = linkResponse.body as EntityLinkBody;

      const response = await agent
        .delete(`/api/v1/risks/${id}/assets/${link.id}`)
        .set('Origin', appOrigin)
        .set('If-Match', linkResponse.headers.etag!);

      expect(response.status).toBe(204);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .delete(`/api/v1/risks/${randomUUID()}/assets/${randomUUID()}`)
        .set('Origin', appOrigin)
        .set('If-Match', '"0"');
      expect(response.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------
  // Registries — GET /processes, /assets. `GET /controls` moved OUT of
  // this describe block (003-controls-management, Task A): it is no
  // longer `RegistryController`'s Fase 1 minimal-registry endpoint —
  // ownership transferred to the Controls Management module's own
  // `ControlController` (`listControlCatalog`,
  // `contracts/controls.openapi.yaml`), which requires `control:view`
  // (never `risk:view` alone) and enforces real organizational scope on
  // every row (data-model.md §9, FR-007) — a control with no organizational
  // unit (this file's own `createControl()` fixture, used elsewhere in
  // this file to exercise `RiskControlLink`, deliberately creates one with
  // no `orgUnitId`) is therefore no longer visible to a caller who only
  // holds a UNIT-scoped grant, which is a genuine, intentional tightening
  // — not a regression. Equivalent coverage (200 for `control:view`, 403
  // for zero permissions, 401 unauthenticated) now lives in
  // `test/contract/control-catalog.spec.ts`.
  //
  // `GET /processes`/`GET /assets` moved the SAME way in
  // 006-assets-processes (Fase 4, T029/T030): ownership transferred to
  // `ProcessController`/`AssetController`, which require
  // `process:view`/`asset:view` — the resource's OWN permission (FR-009),
  // never `risk:view` alone. The two tests below used to assert the
  // OPPOSITE — that `risk:view` alone was sufficient — which was exactly
  // today's defect (US2, SC-002): a Controls/Compliance/Audit user with no
  // authority over Risk could not browse the inventory their own module's
  // link picker needs. They are rewritten here to prove the fix, per
  // FR-009 and SC-006's own requirement that a test changed for this
  // reason cites it explicitly. Equivalent, more complete coverage (scope
  // filtering, search, pagination) lives in
  // `test/contract/{assets,processes}.spec.ts`.
  // -------------------------------------------------------------------

  describe('GET /processes | /assets', () => {
    // FR-009 — reading the inventory requires the resource's OWN
    // permission (`process:view`/`asset:view`), never `risk:view` alone.
    it('FR-009: GET /processes succeeds for a caller holding ONLY process:view (no risk:view at all)', async () => {
      const process = await createProcess();
      const { agent } = await agentWithPermissions(['process:view']);

      const response = await agent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: process.code });

      expect(response.status).toBe(200);
      const body = response.body as RegistryPageBody;
      expect(body.data[0]!.id).toBe(process.id);
    });

    it('FR-009: GET /assets succeeds for a caller holding ONLY asset:view (no risk:view at all)', async () => {
      const asset = await createAsset();
      const { agent } = await agentWithPermissions(['asset:view']);

      const response = await agent
        .get('/api/v1/assets')
        .set('Origin', appOrigin)
        .query({ q: asset.code });

      expect(response.status).toBe(200);
      const body = response.body as RegistryPageBody;
      expect(body.data[0]!.id).toBe(asset.id);
    });

    // FR-009, T031 (006-assets-processes, SC-002) — the exact defect this
    // fase closes: `risk:view` alone used to be sufficient for both
    // endpoints (the assertion these two tests replaced); now it refuses,
    // because the required authority is the resource's own.
    it('FR-009/T031: refuses a caller holding ONLY risk:view (no process:view) on GET /processes — 403', async () => {
      await createProcess();
      const { agent } = await agentWithPermissions(['risk:view']);

      const response = await agent.get('/api/v1/processes').set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('FR-009/T031: refuses a caller holding ONLY risk:view (no asset:view) on GET /assets — 403', async () => {
      await createAsset();
      const { agent } = await agentWithPermissions(['risk:view']);

      const response = await agent.get('/api/v1/assets').set('Origin', appOrigin);

      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller on GET /processes — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/processes');
      expect(response.status).toBe(401);
    });

    it('refuses an unauthenticated caller on GET /assets — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/assets');
      expect(response.status).toBe(401);
    });
  });
});
