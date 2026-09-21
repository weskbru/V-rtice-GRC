/**
 * T044/T057/004-compliance-management, User Story 2/3 — contract coverage
 * for operations 10, 12, 14-23 of `contracts/compliance.openapi.yaml`
 * (requirement read with `complianceState`, requirement-control mapping
 * and its migration, applicability declarations, compliance summary).
 * Uses the real `AppModule` (`buildContractTestApp`), the same convention
 * `compliance-normative-library.spec.ts` (US1) already established.
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

import { buildContractTestApp, type ContractTestContext } from './support/contract-app';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

interface RequirementBody {
  readonly id: string;
  readonly externalRef: string;
  readonly complianceState: string;
  readonly applicability: unknown;
  readonly version: number;
}

interface LinkBody {
  readonly id: string;
  readonly control: { readonly id: string };
  readonly unlinkedAt: string | null;
}

interface ApplicabilityBody {
  readonly id: string;
  readonly justification: string;
  readonly revokedAt: string | null;
}

interface ProblemBody {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: readonly { field: string; message: string }[];
}

describe('Compliance mapping and state (US2/US3, operations 10/12/14-23)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let unitId: string;

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
  ): Promise<ReturnType<typeof request.agent>> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('compliance-map-actor')}@example.test`,
      primaryOrgUnitId: unitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-compliance-map-role-${randomUUID()}`,
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

  async function createControlInScope(): Promise<string> {
    const prisma = ctx.app.get(PrismaService);
    const control = await prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-contract'),
        name: 'Controle de contrato',
        orgUnitId: unitId,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    return control.id;
  }

  async function createControlOutOfScope(): Promise<string> {
    const prisma = ctx.app.get(PrismaService);
    const otherUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('other-unit') });
    const control = await prisma.client.control.create({
      data: {
        code: uniqueTestMarker('ctl-contract-oos'),
        name: 'Controle fora de escopo',
        orgUnitId: otherUnit.id,
        status: 'ACTIVE',
        isActive: true,
      },
    });
    return control.id;
  }

  async function createFrameworkVersionWithRequirement(
    agent: ReturnType<typeof request.agent>,
  ): Promise<{ frameworkId: string; versionId: string; requirementId: string }> {
    const frameworkResponse = await agent
      .post('/api/v1/frameworks')
      .set('Origin', appOrigin)
      .send({
        name: uniqueTestMarker('Framework de contrato'),
        description: 'Framework de teste de contrato.',
        origin: 'EXTERNAL_STANDARD',
      });
    const frameworkId = (frameworkResponse.body as { id: string }).id;

    const versionResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions`)
      .set('Origin', appOrigin)
      .send({ label: uniqueTestMarker('v') });
    const versionId = (versionResponse.body as { id: string }).id;

    const requirementResponse = await agent
      .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
      .set('Origin', appOrigin)
      .send({ externalRef: 'A.1', title: 'Requisito de contrato', description: 'Descrição.' });
    const requirementId = (requirementResponse.body as { id: string }).id;

    return { frameworkId, versionId, requirementId };
  }

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('compliance-map'),
    });
    unitId = orgUnit.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /requirements/{id} and GET .../requirements (getRequirement, listRequirements)', () => {
    it('serves complianceState on both the single and the list read, with Cache-Control: no-store and no version-based ETag on either', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { frameworkId, versionId, requirementId } =
        await createFrameworkVersionWithRequirement(agent);

      const getResponse = await agent
        .get(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin);
      expect(getResponse.status).toBe(200);
      expect((getResponse.body as RequirementBody).complianceState).toBe('NOT_MET');
      // complianceState is derived fresh on every read and never reflected
      // in `version` (research.md D-8) — the concurrency token (`version`,
      // echoed via PATCH's own ETag) must never masquerade as a cache
      // freshness validator for this body.
      expect(getResponse.headers.etag).toBeUndefined();
      expect(getResponse.headers['cache-control']).toBe('no-store');

      const listResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      expect(listResponse.headers['cache-control']).toBe('no-store');
      const items = (listResponse.body as { data: RequirementBody[] }).data;
      expect(items.find((item) => item.id === requirementId)?.complianceState).toBe('NOT_MET');
    });

    it('reflects a control link immediately on the next GET — the confirmed browser defect (linking a control left the requirement showing its previous state until a hard reload)', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — control:view is required to link a requirement
        // to a control, exactly like the linking tests above.
        'control:view',
      ]);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);
      const controlId = await createControlInScope();

      const beforeLink = await agent
        .get(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin);
      expect(beforeLink.status).toBe(200);
      const beforeBody = beforeLink.body as RequirementBody;
      expect(beforeBody.complianceState).toBe('NOT_MET');

      await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });

      const afterLink = await agent
        .get(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin);
      expect(afterLink.status).toBe(200);
      const afterBody = afterLink.body as RequirementBody;
      // An unassessed control makes the requirement NOT_PROVEN, not
      // COMPLIANT (see the compliance-summary assertion below) — any
      // change away from the pre-link NOT_MET proves this GET reflects the
      // link rather than replaying a cached/stale body.
      expect(afterBody.complianceState).toBe('NOT_PROVEN');
      // The requirement's OWN `version` is untouched by linking a control —
      // this is exactly the defect this proves fixed: a naive ETag equal
      // to `version` would be IDENTICAL before and after the link, so a
      // conditional GET replaying that ETag would have been answered `304`
      // with the stale, pre-link body. No `ETag` is present on this route
      // at all (`RequirementController.findById`'s own doc comment), so
      // no cache — nor the server's own request-driven conditional-GET
      // matching — has any validator to serve a stale copy against.
      expect(afterBody.version).toBe(beforeBody.version);
      expect(afterLink.headers.etag).toBeUndefined();
      expect(afterLink.headers['cache-control']).toBe('no-store');
    });

    it('rejects complianceState as an unknown property on createRequirement/updateRequirement (FR-017, T053)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { frameworkId, versionId } = await createFrameworkVersionWithRequirement(agent);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/requirements`)
        .set('Origin', appOrigin)
        .send({
          externalRef: 'A.2',
          title: 'x',
          description: 'x',
          complianceState: 'COMPLIANT',
        });
      expect(response.status).toBe(400);
    });
  });

  describe('POST/GET/DELETE /requirements/{id}/controls (linkRequirementToControl, listRequirementControlLinks, unlinkRequirementFromControl)', () => {
    it('requires compliance:map — a caller with only compliance:view is refused', async () => {
      const adminAgent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { requirementId } = await createFrameworkVersionWithRequirement(adminAgent);
      const controlId = await createControlInScope();

      const viewOnlyAgent = await agentWithPermissions(['compliance:view']);
      const response = await viewOnlyAgent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(response.status).toBe(403);
    });

    it('links a control in scope (201), lists it, then withdraws it (204) — withdrawn link stays visible with includeWithdrawn', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);
      const controlId = await createControlInScope();

      const linkResponse = await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(linkResponse.status).toBe(201);
      const linkId = (linkResponse.body as LinkBody).id;

      const listResponse = await agent
        .get(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      expect((listResponse.body as LinkBody[]).map((link) => link.id)).toContain(linkId);

      const unlinkResponse = await agent
        .delete(`/api/v1/requirements/${requirementId}/controls/${linkId}`)
        .set('Origin', appOrigin);
      expect(unlinkResponse.status).toBe(204);

      const listAfterUnlink = await agent
        .get(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin);
      expect((listAfterUnlink.body as LinkBody[]).map((link) => link.id)).not.toContain(linkId);

      const listWithWithdrawn = await agent
        .get(`/api/v1/requirements/${requirementId}/controls`)
        .query({ includeWithdrawn: 'true' })
        .set('Origin', appOrigin);
      const withdrawn = (listWithWithdrawn.body as LinkBody[]).find((link) => link.id === linkId);
      expect(withdrawn?.unlinkedAt).not.toBeNull();
    });

    it('a control outside scope and a nonexistent control both answer 422, indistinguishably (SC-005, FR-022)', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);
      const outOfScopeControlId = await createControlOutOfScope();

      const outOfScopeResponse = await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: outOfScopeControlId });
      const nonexistentResponse = await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId: randomUUID() });

      expect(outOfScopeResponse.status).toBe(422);
      expect(nonexistentResponse.status).toBe(422);
      expect((outOfScopeResponse.body as ProblemBody).detail).toBe(
        (nonexistentResponse.body as ProblemBody).detail,
      );
    });

    it('an active duplicate link is refused with 409', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);
      const controlId = await createControlInScope();

      await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      const response = await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });
      expect(response.status).toBe(409);
    });
  });

  describe('POST/GET/DELETE /requirements/{id}/applicability-declarations', () => {
    it('requires justification — 422 when missing (FR-015 AS1)', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);

      const response = await agent
        .post(`/api/v1/requirements/${requirementId}/applicability-declarations`)
        .set('Origin', appOrigin)
        .send({});
      expect(response.status).toBe(422);
    });

    it('declares not applicable (201), reflects on the requirement, refuses a second active declaration (409), revokes (204), and re-enters compliance', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const { requirementId } = await createFrameworkVersionWithRequirement(agent);

      const declareResponse = await agent
        .post(`/api/v1/requirements/${requirementId}/applicability-declarations`)
        .set('Origin', appOrigin)
        .send({ justification: 'Não se aplica ao escopo certificado.' });
      expect(declareResponse.status).toBe(201);
      const declarationId = (declareResponse.body as ApplicabilityBody).id;

      const requirementAfterDeclare = await agent
        .get(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin);
      expect((requirementAfterDeclare.body as RequirementBody).complianceState).toBe(
        'NOT_APPLICABLE',
      );

      const duplicateResponse = await agent
        .post(`/api/v1/requirements/${requirementId}/applicability-declarations`)
        .set('Origin', appOrigin)
        .send({ justification: 'Segunda tentativa.' });
      expect(duplicateResponse.status).toBe(409);

      const revokeResponse = await agent
        .delete(`/api/v1/requirements/${requirementId}/applicability-declarations/${declarationId}`)
        .set('Origin', appOrigin);
      expect(revokeResponse.status).toBe(204);

      const requirementAfterRevoke = await agent
        .get(`/api/v1/requirements/${requirementId}`)
        .set('Origin', appOrigin);
      expect((requirementAfterRevoke.body as RequirementBody).complianceState).toBe('NOT_MET');

      const secondRevokeResponse = await agent
        .delete(`/api/v1/requirements/${requirementId}/applicability-declarations/${declarationId}`)
        .set('Origin', appOrigin);
      expect(secondRevokeResponse.status).toBe(422);
    });
  });

  describe('GET .../compliance-summary (getFrameworkVersionComplianceSummary)', () => {
    it('a version with zero requirements reports totalRequirements: 0 and compliancePercentage: null — never 0 or 100', async () => {
      const agent = await agentWithPermissions(['compliance:administer', 'compliance:view']);
      const frameworkResponse = await agent
        .post('/api/v1/frameworks')
        .set('Origin', appOrigin)
        .send({
          name: uniqueTestMarker('Framework sem requisitos'),
          description: 'Framework de teste sem requisitos.',
          origin: 'EXTERNAL_STANDARD',
        });
      const frameworkId = (frameworkResponse.body as { id: string }).id;
      const versionResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions`)
        .set('Origin', appOrigin)
        .send({ label: uniqueTestMarker('v') });
      const versionId = (versionResponse.body as { id: string }).id;

      const summaryResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/compliance-summary`)
        .set('Origin', appOrigin);
      expect(summaryResponse.status).toBe(200);
      const summary = summaryResponse.body as {
        totalRequirements: number;
        compliancePercentage: number | null;
      };
      expect(summary.totalRequirements).toBe(0);
      expect(summary.compliancePercentage).toBeNull();
    });

    it('a requirement linked to an active, but unassessed control counts as NOT_PROVEN, not COMPLIANT', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { frameworkId, versionId, requirementId } =
        await createFrameworkVersionWithRequirement(agent);
      const controlId = await createControlInScope();
      await agent
        .post(`/api/v1/requirements/${requirementId}/controls`)
        .set('Origin', appOrigin)
        .send({ controlId });

      const summaryResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions/${versionId}/compliance-summary`)
        .set('Origin', appOrigin);
      expect(summaryResponse.status).toBe(200);
      const summary = summaryResponse.body as {
        totalRequirements: number;
        applicableRequirementCount: number;
        counts: { notProven: number; compliant: number };
      };
      expect(summary.totalRequirements).toBe(1);
      expect(summary.applicableRequirementCount).toBe(1);
      expect(summary.counts.notProven).toBe(1);
      expect(summary.counts.compliant).toBe(0);
    });
  });

  describe('POST/GET .../mapping-migrations (executeMappingMigration, listMappingMigrations, getMappingMigration)', () => {
    it('refuses a sourceFrameworkVersionId from a different framework with 422', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { frameworkId: frameworkA, versionId: versionA } =
        await createFrameworkVersionWithRequirement(agent);
      const { versionId: versionB } = await createFrameworkVersionWithRequirement(agent);

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkA}/versions/${versionA}/mapping-migrations`)
        .set('Origin', appOrigin)
        .send({ sourceFrameworkVersionId: versionB, correspondences: [] });
      expect(response.status).toBe(422);
    });

    it('refuses a duplicated targetRequirementId within correspondences with 422', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const {
        frameworkId,
        versionId: sourceVersionId,
        requirementId: sourceRequirementId,
      } = await createFrameworkVersionWithRequirement(agent);
      const targetVersionResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions`)
        .set('Origin', appOrigin)
        .send({ label: uniqueTestMarker('v-destino') });
      const targetVersionId = (targetVersionResponse.body as { id: string }).id;
      const targetRequirementResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/requirements`)
        .set('Origin', appOrigin)
        .send({ externalRef: 'A.1', title: 'Destino', description: 'x' });
      const targetRequirementId = (targetRequirementResponse.body as { id: string }).id;

      const response = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/mapping-migrations`)
        .set('Origin', appOrigin)
        .send({
          sourceFrameworkVersionId: sourceVersionId,
          correspondences: [
            { targetRequirementId, sourceRequirementIds: [sourceRequirementId] },
            { targetRequirementId, sourceRequirementIds: [sourceRequirementId] },
          ],
        });
      expect(response.status).toBe(422);
    });

    it('executes a migration (201), lists it, and reads its full detail — an empty correspondences body is legal (everything PENDING_DECISION, FR-013)', async () => {
      const agent = await agentWithPermissions([
        'compliance:administer',
        'compliance:map',
        'compliance:view',
        // ADR-020 part 5 — this fixture's agent now needs to see the
        // referenced control (`control:view`), not only `compliance:map`,
        // to link a requirement to it — `LinkRequirementToControlUseCase`
        // now enforces both halves of the pairing.
        'control:view',
      ]);
      const { frameworkId, versionId: sourceVersionId } =
        await createFrameworkVersionWithRequirement(agent);
      const targetVersionResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions`)
        .set('Origin', appOrigin)
        .send({ label: uniqueTestMarker('v-destino') });
      const targetVersionId = (targetVersionResponse.body as { id: string }).id;
      await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/requirements`)
        .set('Origin', appOrigin)
        .send({ externalRef: 'A.1', title: 'Destino pendente', description: 'x' });

      const executeResponse = await agent
        .post(`/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/mapping-migrations`)
        .set('Origin', appOrigin)
        .send({ sourceFrameworkVersionId: sourceVersionId, correspondences: [] });
      expect(executeResponse.status).toBe(201);
      const migration = executeResponse.body as {
        id: string;
        pendingDecisionCount: number;
        items: readonly { outcome: string }[];
      };
      expect(migration.pendingDecisionCount).toBe(1);
      expect(migration.items.every((item) => item.outcome === 'PENDING_DECISION')).toBe(true);

      const listResponse = await agent
        .get(`/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/mapping-migrations`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      expect(
        (listResponse.body as { data: { id: string }[] }).data.some(
          (entry) => entry.id === migration.id,
        ),
      ).toBe(true);

      const getResponse = await agent
        .get(
          `/api/v1/frameworks/${frameworkId}/versions/${targetVersionId}/mapping-migrations/${migration.id}`,
        )
        .set('Origin', appOrigin);
      expect(getResponse.status).toBe(200);
      expect((getResponse.body as { items: unknown[] }).items.length).toBe(migration.items.length);
    });
  });
});
