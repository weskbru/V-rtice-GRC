/**
 * T024,T025,T026,T027,T028/006-assets-processes, User Story 1 — contract
 * coverage for all six operations of `contracts/processes.openapi.yaml`
 * (`listProcessCatalog`, `createProcess`, `getProcess`, `updateProcess`,
 * `deactivateProcess`, `reactivateProcess`).
 *
 * Uses `buildContractTestApp` (`support/contract-app.ts`) — the REAL
 * `AppModule`, unmodified. Until T029 (Fase 4) this file used a dedicated
 * harness (`support/assets-processes-contract-app.ts`) because `GET
 * /assets`/`GET /processes` were declared on TWO controllers at once (the
 * retired `RegistryController`, `modules/risk`, and this module's own
 * `AssetController`/`ProcessController`) and `RiskModule` won route
 * dispatch by import order in the real `AppModule`. T029 removed
 * `RegistryController`'s two routes for good, so there is only one
 * handler per path again — the dedicated harness became redundant with
 * `buildContractTestApp` and was deleted, exactly as that harness's own
 * header anticipated for itself.
 *
 * ## Zero-permission caller on a single-record route: 403, not 404
 *
 * `contracts/processes.openapi.yaml`'s own `NotFound` response prose says a
 * caller lacking `process:view` ENTIRELY also collapses into the same 404 as
 * out-of-scope/nonexistent. The actual, already-shipped platform
 * architecture disagrees: `@RequirePermission('process:view')`
 * (`PermissionGuard`) runs BEFORE any use case and refuses with a flat 403
 * for a caller who holds NO permission at all, regardless of the specific
 * record — see that guard's own header ("this guard's decision depends
 * only on the caller's role-held permissions, never on any specific
 * record"). `test/contract/control-catalog.spec.ts` already encodes and
 * accepts this EXACT split for `control:view` (its own contract's prose
 * makes the identical "lacks control:view entirely" claim). This file
 * follows the same, already-established precedent rather than diverging
 * from it — reported as a contract/implementation discrepancy that
 * predates this fase, not fixed here.
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
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import { createLocalUserFixture, createOrgUnitFixture } from '../integration/support/fixtures';

import { buildContractTestApp } from './support/contract-app';

import type { ContractTestContext } from './support/contract-app';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
}

interface ProcessOrgUnitRefBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface ProcessSummaryBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: ProcessOrgUnitRefBody | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

interface ProcessDetailBody extends ProcessSummaryBody {
  readonly description: string | null;
  readonly risks: readonly { readonly id: string; readonly code: string; readonly title: string }[];
  readonly controls: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
  }[];
  readonly createdAt: string;
}

interface CatalogPageBody {
  readonly data: readonly ProcessSummaryBody[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

describe('Process catalog and record (006-assets-processes, User Story 1, operations 1-6)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    unitId: string = orgUnitId,
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('process-catalog-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-process-catalog-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: unitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return agent;
  }

  async function createProcess(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<ProcessDetailBody> {
    const response = await agent
      .post('/api/v1/processes')
      .set('Origin', appOrigin)
      .send({
        name: 'Processo de aprovação de teste',
        description: 'Descrição do processo de teste.',
        orgUnitId,
        ...overrides,
      });
    expect(response.status).toBe(201);
    return response.body as ProcessDetailBody;
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('process-catalog'),
    });
    orgUnitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /processes (createProcess)', () => {
    it('creates an active process with a server-generated PRC- code, Location header, and empty risks/controls', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const response = await agent
        .post('/api/v1/processes')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('process-create'),
          description: 'Um processo novo.',
          orgUnitId,
        });

      expect(response.status).toBe(201);
      const body = response.body as ProcessDetailBody;
      expect(body.code).toMatch(/^PRC-\d{4}-\d{4,}$/);
      expect(body.isActive).toBe(true);
      expect(body.risks).toEqual([]);
      expect(body.controls).toEqual([]);
      expect(body.orgUnit?.id).toBe(orgUnitId);
      expect(response.headers.location).toContain(body.id);
    });

    it('Invariant A3: two processes with the SAME name coexist, with distinct codes', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const sharedName = uniqueTestMarker('process-same-name');

      const first = await createProcess(agent, { name: sharedName });
      const second = await createProcess(agent, { name: sharedName });

      expect(first.id).not.toBe(second.id);
      expect(first.code).not.toBe(second.code);
      expect(first.name).toBe(sharedName);
      expect(second.name).toBe(sharedName);
    });

    it('Invariant A6: a client-supplied code is rejected as an unknown property — 400', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const response = await agent.post('/api/v1/processes').set('Origin', appOrigin).send({
        name: 'Processo inválido',
        description: 'Descrição.',
        orgUnitId,
        code: 'PRC-2026-9999',
      });
      expect(response.status).toBe(400);
    });

    it('Invariant A6: a client-supplied isActive is rejected as an unknown property — 400', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const response = await agent.post('/api/v1/processes').set('Origin', appOrigin).send({
        name: 'Processo inválido',
        description: 'Descrição.',
        orgUnitId,
        isActive: false,
      });
      expect(response.status).toBe(400);
    });

    it('Invariant A1/A2: refuses creation into an organizational unit outside the caller scope — 422', async () => {
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-catalog-other'),
      });
      const agent = await agentWithPermissions(['process:create']);
      const response = await agent.post('/api/v1/processes').set('Origin', appOrigin).send({
        name: 'Processo fora de escopo',
        description: 'Descrição.',
        orgUnitId: otherUnit.id,
      });
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent
        .post('/api/v1/processes')
        .set('Origin', appOrigin)
        .send({ name: 'Processo', description: 'Descrição.', orgUnitId });
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/v1/processes')
        .set('Origin', appOrigin)
        .send({ name: 'Processo', description: 'Descrição.', orgUnitId });
      expect(response.status).toBe(401);
    });

    it('creation is audited with the new values, including the generated code and orgUnitId', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const created = await createProcess(agent, {
        name: uniqueTestMarker('process-audit-create'),
      });

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'process.created' },
      });
      expect(event).not.toBeNull();
      const newValues = event?.newValues as Record<string, unknown> | null;
      expect(newValues?.code).toBe(created.code);
      expect(newValues?.orgUnitId).toBe(orgUnitId);
    });
  });

  describe('GET /processes/{processId} (getProcess)', () => {
    it('returns the process, including empty risks/controls arrays for a fresh record', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:view']);
      const created = await createProcess(agent);

      const response = await agent.get(`/api/v1/processes/${created.id}`).set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as ProcessDetailBody;
      expect(body.id).toBe(created.id);
      expect(body.risks).toEqual([]);
      expect(body.controls).toEqual([]);
    });

    it('an out-of-scope process and a nonexistent process answer with identical 404 problem bodies (FR-010)', async () => {
      const inScopeAgent = await agentWithPermissions(['process:create']);
      const created = await createProcess(inScopeAgent);

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-catalog-scope-b'),
      });
      const outsideAgent = await agentWithPermissions(['process:view'], otherUnit.id);

      const responseForReal = await outsideAgent
        .get(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin);
      const responseForFake = await outsideAgent
        .get(`/api/v1/processes/${randomUUID()}`)
        .set('Origin', appOrigin);

      expect(responseForReal.status).toBe(404);
      expect(responseForFake.status).toBe(404);
      const bodyReal = responseForReal.body as ProblemBody;
      const bodyFake = responseForFake.body as ProblemBody;
      expect(bodyReal.status).toBe(bodyFake.status);
      expect(bodyReal.title).toBe(bodyFake.title);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['process:create']);
      const created = await createProcess(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .get(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get(
        `/api/v1/processes/${randomUUID()}`,
      );
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /processes/{processId} (updateProcess)', () => {
    it('updates name/description and audits previous AND new values', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:view', 'process:edit']);
      const created = await createProcess(agent, { description: 'Descrição original.' });

      const response = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ name: 'Nome atualizado', description: 'Descrição atualizada.' });

      expect(response.status).toBe(200);
      const body = response.body as ProcessDetailBody;
      expect(body.name).toBe('Nome atualizado');
      expect(body.description).toBe('Descrição atualizada.');

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'process.updated' },
      });
      expect(event).not.toBeNull();
      const previousValues = event?.previousValues as Record<string, unknown> | null;
      const newValues = event?.newValues as Record<string, unknown> | null;
      expect(previousValues?.name).toBe(created.name);
      expect(previousValues?.description).toBe('Descrição original.');
      expect(newValues?.name).toBe('Nome atualizado');
      expect(newValues?.description).toBe('Descrição atualizada.');
    });

    it('Invariant A6: code and isActive are read-only and rejected as unknown properties — 400', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:edit']);
      const created = await createProcess(agent);

      const codeResponse = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ code: 'PRC-2026-0001' });
      expect(codeResponse.status).toBe(400);

      const isActiveResponse = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ isActive: false });
      expect(isActiveResponse.status).toBe(400);
    });

    it('rejects an empty body with 400', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:edit']);
      const created = await createProcess(agent);

      const response = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(400);
    });

    it('reassignment into an out-of-scope organizational unit is refused with 422 (Invariant A2)', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:edit']);
      const created = await createProcess(agent);
      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-catalog-reassign'),
      });

      const response = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ orgUnitId: otherUnit.id });
      expect(response.status).toBe(422);
    });

    it('moving a process between units does not affect an existing link (spec Assumption A-4)', async () => {
      const prisma = ctx.app.get(PrismaService);
      const fixture = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker('process-reassign-actor')}@example.test`,
        primaryOrgUnitId: orgUnitId,
      });
      const role = await createRoleWithPermissionsFixture(
        prisma,
        [
          'process:create',
          'process:edit',
          'process:view',
          'control:create',
          'control:view',
          'control:edit',
        ],
        { name: `fixture-process-reassign-role-${randomUUID()}` },
      );
      await assignRoleFixture(prisma, { user: fixture.user, role });
      await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

      const destinationUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('process-reassign-target'),
      });
      // The actor's scope must cover BOTH the origin and the destination
      // unit, or the reassignment itself would be refused by Invariant A2
      // — unrelated to the fact under test here (A-4: existing links
      // survive a transfer).
      await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: destinationUnit.id });

      const agent = request.agent(ctx.app.getHttpServer());
      const loginResponse = await agent
        .post('/api/v1/auth/login')
        .set('Origin', appOrigin)
        .send({ email: fixture.user.email, password: fixture.rawPassword });
      expect(loginResponse.status).toBe(200);

      const created = await createProcess(agent);
      const controlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('process-reassign-control'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(controlResponse.status).toBe(201);
      const controlId = (controlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${controlId}/processes`)
        .set('Origin', appOrigin)
        .send({ id: created.id });
      expect(linkResponse.status).toBe(201);

      const moveResponse = await agent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ orgUnitId: destinationUnit.id });
      expect(moveResponse.status).toBe(200);
      expect((moveResponse.body as ProcessDetailBody).orgUnit?.id).toBe(destinationUnit.id);

      // The link created before the move remains visible, from both
      // sides.
      const processDetail = await agent
        .get(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin);
      expect((processDetail.body as ProcessDetailBody).controls).toHaveLength(1);
      const controlLinks = await agent
        .get(`/api/v1/controls/${controlId}/processes`)
        .set('Origin', appOrigin);
      expect((controlLinks.body as unknown[]).length).toBe(1);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['process:create']);
      const created = await createProcess(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .patch(`/api/v1/processes/${created.id}`)
        .set('Origin', appOrigin)
        .send({ name: 'x' });
      expect(response.status).toBe(403);
    });
  });

  describe('POST /processes/{processId}/deactivate and /reactivate', () => {
    it('deactivates an active process, and the transition is audited', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
      ]);
      const created = await createProcess(agent);

      const response = await agent
        .post(`/api/v1/processes/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as ProcessDetailBody).isActive).toBe(false);

      const prisma = ctx.app.get(PrismaService);
      const event = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'process.deactivated' },
      });
      expect(event).not.toBeNull();
    });

    it('deactivating an already-inactive process is refused with 422, nothing changes', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
      ]);
      const created = await createProcess(agent);
      await agent.post(`/api/v1/processes/${created.id}/deactivate`).set('Origin', appOrigin);

      const response = await agent
        .post(`/api/v1/processes/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);

      const current = await agent.get(`/api/v1/processes/${created.id}`).set('Origin', appOrigin);
      expect((current.body as ProcessDetailBody).isActive).toBe(false);
    });

    it('reactivates an inactive process, and BOTH transitions appear in the audit trail', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
      ]);
      const created = await createProcess(agent);
      await agent.post(`/api/v1/processes/${created.id}/deactivate`).set('Origin', appOrigin);

      const response = await agent
        .post(`/api/v1/processes/${created.id}/reactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      expect((response.body as ProcessDetailBody).isActive).toBe(true);

      const prisma = ctx.app.get(PrismaService);
      const deactivatedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'process.deactivated' },
      });
      const reactivatedEvent = await prisma.client.auditEvent.findFirst({
        where: { entityId: created.id, action: 'process.reactivated' },
      });
      expect(deactivatedEvent).not.toBeNull();
      expect(reactivatedEvent).not.toBeNull();
    });

    it('reactivating an already-active process is refused with 422, nothing changes', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
      ]);
      const created = await createProcess(agent);

      const response = await agent
        .post(`/api/v1/processes/${created.id}/reactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);
    });

    it('refuses a caller with zero permissions — 403', async () => {
      const creator = await agentWithPermissions(['process:create']);
      const created = await createProcess(creator);
      const zeroAgent = await agentWithPermissions([]);
      const response = await zeroAgent
        .post(`/api/v1/processes/${created.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('SC-007: a deactivated process stays readable and stays visible in a link created before deactivation, but a NEW link to it is refused', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const process_ = await createProcess(agent, { name: uniqueTestMarker('process-sc007') });

      const firstControlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('process-sc007-control-1'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(firstControlResponse.status).toBe(201);
      const firstControlId = (firstControlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${firstControlId}/processes`)
        .set('Origin', appOrigin)
        .send({ id: process_.id });
      expect(linkResponse.status).toBe(201);

      const deactivateResponse = await agent
        .post(`/api/v1/processes/${process_.id}/deactivate`)
        .set('Origin', appOrigin);
      expect(deactivateResponse.status).toBe(200);

      // Stays fully readable.
      const readAfterDeactivate = await agent
        .get(`/api/v1/processes/${process_.id}`)
        .set('Origin', appOrigin);
      expect(readAfterDeactivate.status).toBe(200);

      // Stays visible in the EXISTING link, from both the process's own
      // detail and the control's own relationship listing.
      expect((readAfterDeactivate.body as ProcessDetailBody).controls).toHaveLength(1);
      const existingLinkListing = await agent
        .get(`/api/v1/controls/${firstControlId}/processes`)
        .set('Origin', appOrigin);
      expect(existingLinkListing.status).toBe(200);
      expect((existingLinkListing.body as unknown[]).length).toBe(1);

      // Refused for a NEW link, to a DIFFERENT control.
      const secondControlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('process-sc007-control-2'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(secondControlResponse.status).toBe(201);
      const secondControlId = (secondControlResponse.body as { id: string }).id;

      const newLinkResponse = await agent
        .post(`/api/v1/controls/${secondControlId}/processes`)
        .set('Origin', appOrigin)
        .send({ id: process_.id });
      expect(newLinkResponse.status).not.toBe(201);

      const linksOnSecondControl = await agent
        .get(`/api/v1/controls/${secondControlId}/processes`)
        .set('Origin', appOrigin);
      expect((linksOnSecondControl.body as unknown[]).length).toBe(0);
    });

    it('SC-007 (reverse): reactivating restores linkability', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
        'control:create',
        'control:view',
        'control:edit',
      ]);
      const process_ = await createProcess(agent, {
        name: uniqueTestMarker('process-sc007-reverse'),
      });
      await agent.post(`/api/v1/processes/${process_.id}/deactivate`).set('Origin', appOrigin);
      await agent.post(`/api/v1/processes/${process_.id}/reactivate`).set('Origin', appOrigin);

      const controlResponse = await agent
        .post('/api/v1/controls')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('process-sc007-reverse-control'),
          description: 'Controle de teste.',
          orgUnitId,
        });
      expect(controlResponse.status).toBe(201);
      const controlId = (controlResponse.body as { id: string }).id;

      const linkResponse = await agent
        .post(`/api/v1/controls/${controlId}/processes`)
        .set('Origin', appOrigin)
        .send({ id: process_.id });
      expect(linkResponse.status).toBe(201);
    });
  });

  describe('GET /processes (listProcessCatalog)', () => {
    it('lists a process within the caller organizational scope, with the ProcessSummary shape', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:view']);
      const created = await createProcess(agent, {
        name: uniqueTestMarker('process-catalog-list'),
      });

      const response = await agent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(1);
      const row = body.data[0]!;
      expect(row.id).toBe(created.id);
      expect(row.code).toBe(created.code);
      expect(row.isActive).toBe(true);
      expect(body.meta).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it('SC-003b: does not list a process outside the caller organizational scope, and excludes it from the total', async () => {
      const agent = await agentWithPermissions(['process:create']);
      const created = await createProcess(agent, {
        name: uniqueTestMarker('process-catalog-scope-excl'),
      });

      const otherUnit = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-catalog-scope-c'),
      });
      const outsideAgent = await agentWithPermissions(['process:view'], otherUnit.id);

      const response = await outsideAgent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: created.code });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    // T033 (006-assets-processes, SC-003b) — the closure of "Vazamento 1":
    // an actor scoped to unit A, listing WITHOUT any search filter (so a
    // leak would surface unit B's row directly, not only via the previous
    // test's exact-code search), sees unit A's process and NEVER unit B's
    // — not in the returned page, not in `meta.total`, not across
    // pagination (`meta.totalPages`). Before the cutover (T029),
    // `RegistryController` applied no scope at all and this test fails
    // against that code.
    it('T033: an actor scoped to unit A never receives unit B in the body, the total, or pagination', async () => {
      const unitA = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-scope-a'),
      });
      const unitB = await createOrgUnitFixture(ctx.app.get(PrismaService), {
        code: uniqueTestMarker('process-scope-b'),
      });
      const marker = uniqueTestMarker('process-scope-pair');

      const agentA = await agentWithPermissions(['process:create', 'process:view'], unitA.id);
      const processA = await createProcess(agentA, { name: `${marker}-a`, orgUnitId: unitA.id });

      const agentB = await agentWithPermissions(['process:create'], unitB.id);
      const processB = await createProcess(agentB, { name: `${marker}-b`, orgUnitId: unitB.id });

      const response = await agentA
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: marker, pageSize: 100 });

      expect(response.status).toBe(200);
      const body = response.body as CatalogPageBody;
      const ids = body.data.map((row) => row.id);
      expect(ids).toContain(processA.id);
      expect(ids).not.toContain(processB.id);
      expect(body.meta.total).toBe(1);
      expect(body.meta.totalPages).toBe(1);
    });

    it('filters by isActive', async () => {
      const agent = await agentWithPermissions([
        'process:create',
        'process:view',
        'process:administer',
      ]);
      const created = await createProcess(agent, {
        name: uniqueTestMarker('process-catalog-active-filter'),
      });
      await agent.post(`/api/v1/processes/${created.id}/deactivate`).set('Origin', appOrigin);

      const activeOnly = await agent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: created.code, isActive: 'true' });
      expect((activeOnly.body as CatalogPageBody).data).toHaveLength(0);

      const inactiveOnly = await agent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: created.code, isActive: 'false' });
      expect((inactiveOnly.body as CatalogPageBody).data).toHaveLength(1);
    });

    it('searches by name', async () => {
      const agent = await agentWithPermissions(['process:create', 'process:view']);
      const marker = uniqueTestMarker('process-catalog-name-search');
      const created = await createProcess(agent, { name: marker });

      const response = await agent
        .get('/api/v1/processes')
        .set('Origin', appOrigin)
        .query({ q: marker });
      expect((response.body as CatalogPageBody).data.map((row) => row.id)).toContain(created.id);
    });

    it('refuses a caller with zero permissions — flat 403 (the one listing exception to the non-disclosure shape)', async () => {
      const agent = await agentWithPermissions([]);
      const response = await agent.get('/api/v1/processes').set('Origin', appOrigin);
      expect(response.status).toBe(403);
    });

    it('refuses an unauthenticated caller — 401', async () => {
      const response = await request(ctx.app.getHttpServer()).get('/api/v1/processes');
      expect(response.status).toBe(401);
    });
  });
});
