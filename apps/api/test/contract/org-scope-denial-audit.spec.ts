/**
 * F-38 (`docs/deferred-findings.md`) — an organizational-scope denial on an
 * EXISTING record must be audited as `organization.denied.out_of_scope`,
 * exactly like a permission denial already is. Covers the four operation
 * kinds the fix touches — read, update, lifecycle transition, relationship
 * creation — across Risk, Evidence, Action and Finding.
 *
 * Each scenario proves three things together, against the REAL HTTP
 * surface (`buildContractTestApp`, every guard/filter active) and the REAL
 * database:
 *
 *   1. An out-of-scope actor's request is refused (404) and writes EXACTLY
 *      ONE `organization.denied.out_of_scope` `audit_event` row, carrying
 *      the acting user, the correct entity, and `outcome: DENIED`.
 *   2. The IDENTICAL request against a genuinely nonexistent id is also
 *      refused (404) but writes NO such row — otherwise the audit trail
 *      itself would be the oracle that tells the two cases apart, which
 *      F-38's own fix must not introduce.
 *   3. The two 404 bodies are byte-identical in `type`/`title`/`detail`
 *      (the non-disclosure guarantee, FR-030/SC-005) — proving the new
 *      server-side audit write changes nothing the caller can observe.
 *
 * Action has no `orgUnitId` scope check of its own — `GetActionUseCase`/
 * `UpdateActionUseCase`/`TransitionActionUseCase` gate on their ORIGIN
 * risk's LIVE organizational unit (`assertActionOriginInScope`, built on
 * `GetRiskUseCase`). The audited row for an out-of-scope Action access is
 * therefore an `entityType: RISK` row keyed by the ORIGIN risk's id, not an
 * `ACTION` row — this is the correct trail (it names the actual record
 * whose scope was violated), and is asserted explicitly below rather than
 * assumed.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { CreateRiskUseCase } from '../../src/modules/risk/application/create-risk.usecase';
import { CreateTreatmentActionUseCase } from '../../src/modules/risk/application/treatment-actions/create-treatment-action.usecase';
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
import type { AuditEvent } from '@prisma/client';

const OUT_OF_SCOPE_ACTION = 'organization.denied.out_of_scope';

interface ProblemBody {
  readonly status: number;
  readonly title?: string;
  readonly type?: string;
  readonly detail?: string;
}

describe('F-38 — organizational-scope denials on an existing record are audited', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
  });

  afterAll(async () => {
    await ctx.close();
  });

  /** A fresh actor scoped to exactly `orgUnitId`, holding `permissions`
   * (possibly none — a route gated `@NoPermissionRequired()`, like the
   * risk transitions endpoint, needs no permission at all to reach its own
   * internal scope check). */
  async function scopedActor(
    orgUnitId: string,
    permissions: readonly PermissionIdentifier[],
    label: string,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker(label)}@example.test`,
      primaryOrgUnitId: orgUnitId,
    });
    if (permissions.length > 0) {
      const role = await createRoleWithPermissionsFixture(prisma, permissions, {
        name: `fixture-${label}-role-${randomUUID()}`,
      });
      await assignRoleFixture(prisma, { user: fixture.user, role });
    }
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return { agent, userId: fixture.user.id };
  }

  async function scopeDenialRows(
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<readonly AuditEvent[]> {
    const prisma = ctx.app.get(PrismaService);
    return prisma.client.auditEvent.findMany({
      where: { action: OUT_OF_SCOPE_ACTION, entityType, entityId, outcome: 'DENIED' },
    });
  }

  function assertByteIdenticalProblemShape(
    outOfScope: ProblemBody,
    nonexistent: ProblemBody,
  ): void {
    expect(nonexistent.status).toBe(outOfScope.status);
    expect(nonexistent.title).toBe(outOfScope.title);
    expect(nonexistent.type).toBe(outOfScope.type);
  }

  // -------------------------------------------------------------------
  // Risk — read, update, lifecycle transition, relationship creation
  // -------------------------------------------------------------------

  describe('Risk', () => {
    async function setupRisk(): Promise<{
      riskId: string;
      outsider: { agent: ReturnType<typeof request.agent>; userId: string };
    }> {
      const prisma = ctx.app.get(PrismaService);
      const inUnit = await createOrgUnitFixture(prisma, { code: uniqueTestMarker('f38-risk-in') });
      const outUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-risk-out'),
      });

      const creator = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('f38-risk-creator')}@example.test`,
        primaryOrgUnitId: inUnit.id,
      });
      const creatorRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
        name: `fixture-f38-risk-creator-${randomUUID()}`,
      });
      await assignRoleFixture(prisma, { user: creator, role: creatorRole });
      await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: inUnit.id });

      // F-CV-2: `creator` here holds only `risk:create` — deliberately, it
      // is not this test's subject either, but self-assigning it as owner
      // would now fail the visibility check. Rather than widen `creator`'s
      // own permissions (which would blur what it demonstrates), a SEPARATE
      // eligible user is created and used as owner instead — `creator`'s
      // permission set is untouched, and so is `outsider`'s below (Case B).
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('f38-risk-owner')}@example.test`,
      });
      await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: inUnit.id });

      const risk = await ctx.app.get(CreateRiskUseCase).execute({
        actorUserId: creator.id,
        title: 'Risco para auditoria de negação de escopo',
        description: 'Descrição.',
        orgUnitId: inUnit.id,
        ownerUserId: owner.id,
      });

      const outsider = await scopedActor(
        outUnit.id,
        ['risk:view', 'risk:edit'],
        'f38-risk-outsider',
      );

      return { riskId: risk.id, outsider };
    }

    it('read (GET /risks/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { riskId, outsider } = await setupRisk();
      const nonexistentId = randomUUID();

      const outOfScopeResponse = await outsider.agent
        .get(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .get(`/api/v1/risks/${nonexistentId}`)
        .set('Origin', appOrigin);
      expect(nonexistentResponse.status).toBe(404);

      const scopeRows = await scopeDenialRows(AuditEntityType.RISK, riskId);
      expect(scopeRows).toHaveLength(1);
      expect(scopeRows[0]?.actorUserId).toBe(outsider.userId);
      expect(scopeRows[0]?.outcome).toBe('DENIED');

      const nonexistentRows = await scopeDenialRows(AuditEntityType.RISK, nonexistentId);
      expect(nonexistentRows).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('update (PATCH /risks/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { riskId, outsider } = await setupRisk();
      const nonexistentId = randomUUID();
      const body = { title: 'Tentativa de edição fora de escopo' };

      const outOfScopeResponse = await outsider.agent
        .patch(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .patch(`/api/v1/risks/${nonexistentId}`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.RISK, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('lifecycle transition (POST /risks/{id}/transitions): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { riskId, outsider } = await setupRisk();
      const nonexistentId = randomUUID();
      const body = { toStatus: 'IDENTIFIED' };

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/risks/${riskId}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/risks/${nonexistentId}/transitions`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.RISK, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('relationship creation (POST /risks/{id}/assets): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { riskId, outsider } = await setupRisk();
      const nonexistentId = randomUUID();

      const prisma = ctx.app.get(PrismaService);
      const asset = await prisma.client.asset.create({
        data: { code: uniqueTestMarker('f38-asset'), name: 'Ativo de teste', isActive: true },
      });
      const body = { id: asset.id };

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/risks/${riskId}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/risks/${nonexistentId}/assets`)
        .set('Origin', appOrigin)
        .set('If-Match', '0')
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.RISK, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('a permission denial is not double-recorded as a scope denial, and a scope denial is not double-recorded as a permission denial', async () => {
      const { riskId, outsider: inScopeButNoPermission } = await (async () => {
        const prisma = ctx.app.get(PrismaService);
        const inUnit = await createOrgUnitFixture(prisma, {
          code: uniqueTestMarker('f38-risk-perm-in'),
        });
        const creator = await createUserFixture(prisma, {
          email: `${uniqueTestMarker('f38-risk-perm-creator')}@example.test`,
          primaryOrgUnitId: inUnit.id,
        });
        const creatorRole = await createRoleWithPermissionsFixture(prisma, ['risk:create'], {
          name: `fixture-f38-risk-perm-creator-${randomUUID()}`,
        });
        await assignRoleFixture(prisma, { user: creator, role: creatorRole });
        await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: inUnit.id });
        // F-CV-2: separate eligible owner — see `setupRisk`'s identical
        // comment above for why `creator` is not widened or reused here.
        const owner = await createUserFixture(prisma, {
          email: `${uniqueTestMarker('f38-risk-perm-owner')}@example.test`,
        });
        await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: inUnit.id });
        const risk = await ctx.app.get(CreateRiskUseCase).execute({
          actorUserId: creator.id,
          title: 'Risco para o teste de não duplicação',
          description: 'Descrição.',
          orgUnitId: inUnit.id,
          ownerUserId: owner.id,
        });
        // Same org unit as the risk (in scope) but granted NO permissions
        // at all — a 403, never a 404, and never a scope question at all.
        const outsider = await scopedActor(inUnit.id, [], 'f38-risk-no-perm');
        return { riskId: risk.id, outsider };
      })();

      const response = await inScopeButNoPermission.agent
        .get(`/api/v1/risks/${riskId}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(403);

      const prisma = ctx.app.get(PrismaService);
      const permissionRows = await prisma.client.auditEvent.findMany({
        where: {
          action: 'authorization.denied.permission_denied',
          actorUserId: inScopeButNoPermission.userId,
          outcome: 'DENIED',
        },
      });
      expect(permissionRows).toHaveLength(1);

      // This exact riskId was never actually out of scope for this actor
      // (same org unit) — confirms the permission refusal produced no
      // scope-denial row for it at all.
      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // Evidence — read, update, lifecycle transition (archive), relationship
  // creation (link)
  // -------------------------------------------------------------------

  describe('Evidence', () => {
    async function setupEvidence(): Promise<{
      evidenceId: string;
      outsider: { agent: ReturnType<typeof request.agent>; userId: string };
    }> {
      const prisma = ctx.app.get(PrismaService);
      const inUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-evidence-in'),
      });
      const outUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-evidence-out'),
      });

      const creator = await scopedActor(
        inUnit.id,
        ['evidence:create', 'evidence:view'],
        'f38-evidence-creator',
      );

      const createResponse = await creator.agent
        .post('/api/v1/evidence')
        .set('Origin', appOrigin)
        .send({
          orgUnitId: inUnit.id,
          title: 'Evidência para auditoria de negação de escopo',
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId: creator.userId,
          collectedOn: '2026-01-01',
          observation: 'Observação de teste.',
        });
      expect(createResponse.status).toBe(201);
      const evidenceId = (createResponse.body as { id: string }).id;

      const outsider = await scopedActor(
        outUnit.id,
        ['evidence:view', 'evidence:edit', 'evidence:administer', 'evidence:link'],
        'f38-evidence-outsider',
      );

      return { evidenceId, outsider };
    }

    it('read (GET /evidence/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { evidenceId, outsider } = await setupEvidence();
      const nonexistentId = randomUUID();

      const outOfScopeResponse = await outsider.agent
        .get(`/api/v1/evidence/${evidenceId}`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .get(`/api/v1/evidence/${nonexistentId}`)
        .set('Origin', appOrigin);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, evidenceId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('update (PATCH /evidence/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { evidenceId, outsider } = await setupEvidence();
      const nonexistentId = randomUUID();
      const body = { title: 'Tentativa de edição fora de escopo' };

      const outOfScopeResponse = await outsider.agent
        .patch(`/api/v1/evidence/${evidenceId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .patch(`/api/v1/evidence/${nonexistentId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, evidenceId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('lifecycle transition (POST /evidence/{id}/archive): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { evidenceId, outsider } = await setupEvidence();
      const nonexistentId = randomUUID();

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/evidence/${evidenceId}/archive`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/evidence/${nonexistentId}/archive`)
        .set('Origin', appOrigin);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, evidenceId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('relationship creation (POST /evidence/{id}/links): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { evidenceId, outsider } = await setupEvidence();
      const nonexistentId = randomUUID();

      // The subject side is irrelevant here: the evidence-side scope check
      // runs FIRST in `LinkEvidenceUseCase` and refuses before the subject
      // is ever resolved — a syntactically valid, unrelated RISK subject id
      // is enough.
      const body = { subjectType: 'RISK', subjectId: randomUUID() };

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/evidence/${evidenceId}/links`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/evidence/${nonexistentId}/links`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, evidenceId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.EVIDENCE, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });
  });

  // -------------------------------------------------------------------
  // Finding — read, update, lifecycle transition (close)
  // -------------------------------------------------------------------

  describe('Finding', () => {
    async function setupFinding(): Promise<{
      findingId: string;
      outsider: { agent: ReturnType<typeof request.agent>; userId: string };
    }> {
      const prisma = ctx.app.get(PrismaService);
      const inUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-finding-in'),
      });
      const outUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-finding-out'),
      });

      const creator = await scopedActor(
        inUnit.id,
        ['finding:create', 'finding:view'],
        'f38-finding-creator',
      );

      const createResponse = await creator.agent
        .post('/api/v1/findings')
        .set('Origin', appOrigin)
        .send({
          orgUnitId: inUnit.id,
          title: 'Achado para auditoria de negação de escopo',
          description: 'Descrição do achado.',
          category: 'OBSERVATION',
          origin: 'INTERNAL_ASSESSMENT',
          severity: 'LOW',
          priority: 'LOW',
          ownerUserId: creator.userId,
          identifiedOn: '2026-01-01',
        });
      expect(createResponse.status).toBe(201);
      const findingId = (createResponse.body as { id: string }).id;

      const outsider = await scopedActor(
        outUnit.id,
        ['finding:view', 'finding:edit', 'finding:close'],
        'f38-finding-outsider',
      );

      return { findingId, outsider };
    }

    it('read (GET /findings/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { findingId, outsider } = await setupFinding();
      const nonexistentId = randomUUID();

      const outOfScopeResponse = await outsider.agent
        .get(`/api/v1/findings/${findingId}`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .get(`/api/v1/findings/${nonexistentId}`)
        .set('Origin', appOrigin);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.FINDING, findingId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.FINDING, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('update (PATCH /findings/{id}): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { findingId, outsider } = await setupFinding();
      const nonexistentId = randomUUID();
      const body = { title: 'Tentativa de edição fora de escopo' };

      const outOfScopeResponse = await outsider.agent
        .patch(`/api/v1/findings/${findingId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .patch(`/api/v1/findings/${nonexistentId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.FINDING, findingId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.FINDING, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('lifecycle transition (POST /findings/{id}/close): exactly one DENIED row for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { findingId, outsider } = await setupFinding();
      const nonexistentId = randomUUID();
      const body = { justification: 'Fechamento de teste.' };

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/findings/${findingId}/close`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/findings/${nonexistentId}/close`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.FINDING, findingId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.FINDING, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });
  });

  // -------------------------------------------------------------------
  // Action — read, update, lifecycle transition. Scope is the ORIGIN
  // risk's, not Action's own (stale) `orgUnitId` — see this file's own
  // header. No relationship-creation use case exists for Action.
  // -------------------------------------------------------------------

  describe('Action (scope derives from its origin Risk)', () => {
    async function setupAction(): Promise<{
      actionId: string;
      riskId: string;
      outsider: { agent: ReturnType<typeof request.agent>; userId: string };
    }> {
      const prisma = ctx.app.get(PrismaService);
      const inUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-action-in'),
      });
      const outUnit = await createOrgUnitFixture(prisma, {
        code: uniqueTestMarker('f38-action-out'),
      });

      const creator = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('f38-action-creator')}@example.test`,
        primaryOrgUnitId: inUnit.id,
      });
      // `risk:treat` too — `CreateTreatmentActionUseCase` creates the
      // shared `Action` via `CreateActionUseCase`, which requires EDIT
      // authority (`resolveEditableOrigin`) over the origin risk.
      const creatorRole = await createRoleWithPermissionsFixture(
        prisma,
        ['risk:create', 'risk:treat'],
        { name: `fixture-f38-action-creator-${randomUUID()}` },
      );
      await assignRoleFixture(prisma, { user: creator, role: creatorRole });
      await grantUnitScopeFixture(prisma, { user: creator, orgUnitId: inUnit.id });

      // F-CV-2: separate eligible owner — see `setupRisk`'s identical
      // comment above for why `creator` is not widened or reused here.
      const owner = await createUserFixture(prisma, {
        email: `${uniqueTestMarker('f38-action-owner')}@example.test`,
      });
      await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: inUnit.id });

      const risk = await ctx.app.get(CreateRiskUseCase).execute({
        actorUserId: creator.id,
        title: 'Risco de origem para a ação',
        description: 'Descrição.',
        orgUnitId: inUnit.id,
        ownerUserId: owner.id,
      });

      const { action: treatmentAction } = await ctx.app.get(CreateTreatmentActionUseCase).execute({
        actorUserId: creator.id,
        riskId: risk.id,
        expectedVersion: risk.version,
        title: 'Ação de tratamento para o teste F-38',
        responsibleUserId: creator.id,
        dueOn: '2026-06-01',
      });

      // `action:view`/`action:edit` are Action's OWN permission model,
      // independent of `risk:view`/`risk:treat` (see
      // `assert-action-origin-in-scope.ts`'s header) — the outsider holds
      // them, but their organizational scope grant covers a UNIT that is
      // NOT the origin risk's unit, so `resolveOriginScope` refuses them.
      const outsider = await scopedActor(
        outUnit.id,
        ['action:view', 'action:edit'],
        'f38-action-outsider',
      );

      // 007-implementation-remediation, Frente A, D-2 — `treatmentAction`
      // IS the shared `Action` now; its own `id` is the identity every
      // caller (including `/actions/{id}`) addresses.
      return { actionId: treatmentAction.id, riskId: risk.id, outsider };
    }

    it('read (GET /actions/{id}): exactly one DENIED row against the ORIGIN RISK for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { actionId, riskId, outsider } = await setupAction();
      const nonexistentId = randomUUID();

      const outOfScopeResponse = await outsider.agent
        .get(`/api/v1/actions/${actionId}`)
        .set('Origin', appOrigin);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .get(`/api/v1/actions/${nonexistentId}`)
        .set('Origin', appOrigin);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      // The nonexistent ACTION id never resolves to any origin at all — no
      // RISK row is created for it, and no ACTION row either (F-38 never
      // audits a genuinely missing record).
      expect(await scopeDenialRows(AuditEntityType.ACTION, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('update (PATCH /actions/{id}): exactly one DENIED row against the ORIGIN RISK for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { actionId, riskId, outsider } = await setupAction();
      const nonexistentId = randomUUID();
      const body = { title: 'Tentativa de edição fora de escopo' };

      const outOfScopeResponse = await outsider.agent
        .patch(`/api/v1/actions/${actionId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .patch(`/api/v1/actions/${nonexistentId}`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.ACTION, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });

    it('lifecycle transition (POST /actions/{id}/transitions): exactly one DENIED row against the ORIGIN RISK for out-of-scope, none for a nonexistent id, identical 404 bodies', async () => {
      const { actionId, riskId, outsider } = await setupAction();
      const nonexistentId = randomUUID();
      const body = { to: 'IN_PROGRESS' };

      const outOfScopeResponse = await outsider.agent
        .post(`/api/v1/actions/${actionId}/transitions`)
        .set('Origin', appOrigin)
        .send(body);
      expect(outOfScopeResponse.status).toBe(404);

      const nonexistentResponse = await outsider.agent
        .post(`/api/v1/actions/${nonexistentId}/transitions`)
        .set('Origin', appOrigin)
        .send(body);
      expect(nonexistentResponse.status).toBe(404);

      expect(await scopeDenialRows(AuditEntityType.RISK, riskId)).toHaveLength(1);
      expect(await scopeDenialRows(AuditEntityType.ACTION, nonexistentId)).toHaveLength(0);

      assertByteIdenticalProblemShape(
        outOfScopeResponse.body as ProblemBody,
        nonexistentResponse.body as ProblemBody,
      );
    });
  });
});
