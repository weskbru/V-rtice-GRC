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

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface FrameworkBody {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: string;
  readonly version: number;
}

interface FrameworkVersionBody {
  readonly id: string;
  readonly framework: { readonly id: string };
  readonly label: string;
  readonly status: string;
  readonly publishedAt: string | null;
  readonly version: number;
}

interface RequirementBody {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: unknown;
  readonly complianceState: string;
  readonly version: number;
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly currentVersion?: number;
}

describe('Compliance normative library (US1, operations 1-9/11/13)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let unitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('compliance-lib-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-compliance-lib-role-${randomUUID()}`,
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

  async function createFramework(
    agent: ReturnType<typeof request.agent>,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string; body: FrameworkBody }> {
    const response = await agent
      .post('/api/v1/frameworks')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('Framework de teste'),
        description: 'Descrição do framework de teste.',
        origin: 'EXTERNAL_STANDARD',
        ...overrides,
      });
    expect(response.status).toBe(201);
    const body = response.body as FrameworkBody;
    return { id: body.id, version: response.headers.etag!, body };
  }

  async function createVersion(
    agent: ReturnType<typeof request.agent>,
    frameworkId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string; body: FrameworkVersionBody }> {
    const response = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions`)
      .set('Origin', appOrigin)
      .send({ label: uniqueTestMarker('v'), ...overrides });
    expect(response.status).toBe(201);
    const body = response.body as FrameworkVersionBody;
    return { id: body.id, version: response.headers.etag!, body };
  }

  async function createRequirement(
    agent: ReturnType<typeof request.agent>,
    frameworkId: string,
    versionId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; version: string; body: RequirementBody }> {
    const response = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
      .set('Origin', appOrigin)
      .send({
        externalRef: 'A.1',
        title: 'Requisito de teste',
        description: 'Descrição do requisito de teste.',
        ...overrides,
      });
    expect(response.status).toBe(201);
    const body = response.body as RequirementBody;
    return { id: body.id, version: response.headers.etag!, body };
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('compliance-lib'),
    });
    unitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /frameworks (createFramework)', () => {
    it('creates a framework with a server-generated FMK- code, and returns Location/ETag', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id, version, body } = await createFramework(agent);

      expect(body.code).toMatch(/^FMK-\d{4}-\d{4,}$/);
      expect(body.version).toBe(1);
      expect(version).toBe('"1"');

      const getResponse = await agent.get(`/api/v1/frameworks/${id}`).set('Origin', appOrigin);
      expect(getResponse.status).toBe(200);
    });

    it('rejects an unknown property (code) as 400', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const response = await agent.post('/api/v1/frameworks').set('Origin', appOrigin).send({
        name: 'x',
        description: 'x',
        origin: 'EXTERNAL_STANDARD',
        code: 'FMK-2026-9999',
      });
      expect(response.status).toBe(400);
    });

    it('requires compliance:administer — a caller with only compliance:view is refused', async () => {
      const agent = await agentWithPermissions(['compliance:view']);
      const response = await agent
        .post('/api/v1/frameworks')
        .set('Origin', appOrigin)
        .send({ name: 'x', description: 'x', origin: 'EXTERNAL_STANDARD' });
      expect(response.status).toBe(403);
    });
  });

  describe('GET /frameworks/{frameworkId} and GET /frameworks (getFramework, listFrameworks)', () => {
    it('404s for a nonexistent framework', async () => {
      const agent = await agentWithPermissions(['compliance:view']);
      const response = await agent
        .get(`/api/v1/frameworks/${randomUUID()}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });

    it('lists frameworks, filterable by q', async () => {
      const adminAgent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { body } = await createFramework(adminAgent);

      const viewAgent = await agentWithPermissions(['compliance:view']);
      const response = await viewAgent
        .get('/api/v1/frameworks')
        .query({ q: body.code })
        .set('Origin', appOrigin);

      expect(response.status).toBe(200);
      const data = (response.body as { data: FrameworkBody[] }).data;
      expect(data.some((f) => f.id === body.id)).toBe(true);
    });
  });

  describe('PATCH /frameworks/{frameworkId} (updateFramework)', () => {
    it('updates descriptive fields with a valid If-Match, and bumps version', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id, version } = await createFramework(agent);

      const response = await agent
        .patch(`/api/v1/frameworks/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Nome atualizado' });

      expect(response.status).toBe(200);
      expect((response.body as FrameworkBody).name).toBe('Nome atualizado');
      expect((response.body as FrameworkBody).version).toBe(2);
    });

    it('requires If-Match — 400 when missing', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id } = await createFramework(agent);

      const response = await agent
        .patch(`/api/v1/frameworks/${id}`)
        .set('Origin', appOrigin)
        .send({ name: 'x' });
      expect(response.status).toBe(400);
    });

    it('a stale If-Match yields 409 with the current version, and nothing is written', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id, version } = await createFramework(agent);

      await agent
        .patch(`/api/v1/frameworks/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Primeira atualização' });

      const staleResponse = await agent
        .patch(`/api/v1/frameworks/${id}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ name: 'Segunda atualização (deveria falhar)' });

      expect(staleResponse.status).toBe(409);
      expect((staleResponse.body as ProblemBody).currentVersion).toBe(2);

      const currentResponse = await agent.get(`/api/v1/frameworks/${id}`).set('Origin', appOrigin);
      expect((currentResponse.body as FrameworkBody).name).toBe('Primeira atualização');
    });
  });

  describe('Framework version CRUD and publication (operations 5-9)', () => {
    it('creates a version in DRAFT, lists it, reads it, edits its label while DRAFT, then publishes it', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version } = await createVersion(agent, frameworkId);

      const listResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      expect(
        (listResponse.body as { data: FrameworkVersionBody[] }).data.some(
          (v) => v.id === versionId,
        ),
      ).toBe(true);

      const getResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions/${versionId}`)
        .set('Origin', appOrigin);
      expect(getResponse.status).toBe(200);
      expect((getResponse.body as FrameworkVersionBody).status).toBe('DRAFT');

      const updateResponse = await agent
        .patch(`/api/v1/frameworks/${frameworkId}/versions/${versionId}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ label: 'v1-revisado' });
      expect(updateResponse.status).toBe(200);
      expect((updateResponse.body as FrameworkVersionBody).label).toBe('v1-revisado');

      await createRequirement(agent, frameworkId, versionId);

      const publishResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', updateResponse.headers.etag!);
      expect(publishResponse.status).toBe(200);
      expect((publishResponse.body as FrameworkVersionBody).status).toBe('PUBLISHED');
      expect((publishResponse.body as FrameworkVersionBody).publishedAt).not.toBeNull();
    });

    it('refuses to publish a version with zero requirements (422, FR-005)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version } = await createVersion(agent, frameworkId);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(response.status).toBe(422);
    });

    it('rejects a second version with a duplicate label within the same framework (422)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      await createVersion(agent, frameworkId, { label: 'duplicated' });

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions`)
        .set('Origin', appOrigin)
        .send({ label: 'duplicated' });
      expect(response.status).toBe(422);
    });

    it('refuses to edit the label of an already-PUBLISHED version (422, FR-006)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version } = await createVersion(agent, frameworkId);
      await createRequirement(agent, frameworkId, versionId);
      const published = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(published.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/frameworks/${frameworkId}/versions/${versionId}`)
        .set('Origin', appOrigin)
        .set('If-Match', published.headers.etag!)
        .send({ label: 'tentativa-pos-publicacao' });
      expect(response.status).toBe(422);
    });

    it('refuses to publish an already-PUBLISHED version a second time (422, one-way transition)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version } = await createVersion(agent, frameworkId);
      await createRequirement(agent, frameworkId, versionId);
      const published = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(published.status).toBe(200);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', published.headers.etag!);
      expect(response.status).toBe(422);
    });
  });

  describe('Requirement create/edit (operations 11, 13)', () => {
    it('creates a requirement on a DRAFT version, with complianceState present and NOT_MET (no controls linked yet)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId } = await createVersion(agent, frameworkId);

      const { body } = await createRequirement(agent, frameworkId, versionId);
      expect(body.complianceState).toBe('NOT_MET');
      expect(body.applicability).toBeNull();
    });

    it('the same externalRef legitimately repeats across two different frameworks — never deduplicated (FR-007)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkAId } = await createFramework(agent, { name: 'Norma A (sweep FR-007)' });
      const { id: versionAId } = await createVersion(agent, frameworkAId);
      const { id: frameworkBId } = await createFramework(agent, { name: 'Norma B (sweep FR-007)' });
      const { id: versionBId } = await createVersion(agent, frameworkBId);

      const { body: requirementA } = await createRequirement(agent, frameworkAId, versionAId, {
        externalRef: 'A.5.16',
      });
      const { body: requirementB } = await createRequirement(agent, frameworkBId, versionBId, {
        externalRef: 'A.5.16',
      });

      expect(requirementA.externalRef).toBe('A.5.16');
      expect(requirementB.externalRef).toBe('A.5.16');
      expect(requirementA.id).not.toBe(requirementB.id);
    });

    it('rejects an unknown property (complianceState) on create as 400', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId } = await createVersion(agent, frameworkId);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
        .set('Origin', appOrigin)
        .send({
          externalRef: 'A.1',
          title: 't',
          description: 'd',
          complianceState: 'COMPLIANT',
        });
      expect(response.status).toBe(400);
    });

    it('edits a requirement while its version is DRAFT', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId } = await createVersion(agent, frameworkId);
      const { id: requirementId, version } = await createRequirement(agent, frameworkId, versionId);

      const response = await agent
        .patch(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'Título revisado' });
      expect(response.status).toBe(200);
      expect((response.body as RequirementBody).title).toBe('Título revisado');
    });

    it('refuses to edit a requirement once its version is PUBLISHED (422, FR-004), and the attempt is audited', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version: versionEtag } = await createVersion(agent, frameworkId);
      const { id: requirementId, version } = await createRequirement(agent, frameworkId, versionId);
      const published = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', versionEtag);
      expect(published.status).toBe(200);

      const response = await agent
        .patch(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin)
        .set('If-Match', version)
        .send({ title: 'Tentativa após publicação' });
      expect(response.status).toBe(422);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { entityId: requirementId, action: 'requirement.update_refused' },
      });
      expect(auditRow).not.toBeNull();
    });

    it('rejects creating a requirement once the version is PUBLISHED (422, FR-004)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { id: frameworkId } = await createFramework(agent);
      const { id: versionId, version } = await createVersion(agent, frameworkId);
      await createRequirement(agent, frameworkId, versionId);
      const published = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/publish`)
        .set('Origin', appOrigin)
        .set('If-Match', version);
      expect(published.status).toBe(200);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
        .set('Origin', appOrigin)
        .send({ externalRef: 'A.2', title: 'x', description: 'x' });
      expect(response.status).toBe(422);
    });
  });
});
