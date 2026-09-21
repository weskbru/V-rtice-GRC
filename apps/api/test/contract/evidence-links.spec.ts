/**
 * D-11 coverage for `/evidence/{evidenceId}/links[/{linkId}/unlink]`
 * (T018/T021/T022/T023/T025, 002-shared-grc-foundation US1):
 * `listEvidenceLinks`, `linkEvidence`, `unlinkEvidence` — the declared
 * shape, both-sides authorization (FR-031), R-010 visibility filtering,
 * historical preservation on archival (SC-004), the adversarial subject
 * cases (valid enum + nonexistent id, out-of-scope subject, duplicate
 * active link, archived evidence, permission revoked mid-session), and
 * semantic audit events.
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
import type { Role } from '@prisma/client';

interface EvidenceBody {
  readonly id: string;
}

interface RiskBody {
  readonly id: string;
  readonly code: string;
}

interface EvidenceLinkBody {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly subjectLabel?: string;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

describe('Evidence Links contract (T018/T021/T022/T023/T025, US1, D-11)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let orgUnitId: string;
  let otherOrgUnitId: string;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('evidence-link-contract-org'),
    });
    orgUnitId = orgUnit.id;
    const otherOrgUnit = await createOrgUnitFixture(prisma, {
      code: uniqueTestMarker('evidence-link-contract-other-org'),
    });
    otherOrgUnitId = otherOrgUnit.id;
    const owner = await createUserFixture(prisma, {
      email: `${uniqueTestMarker('evidence-link-contract-owner')}@example.test`,
    });
    ownerUserId = owner.id;
    // F-CV-2: `owner` is a pure precondition (risk owner, evidence owner) —
    // not the object of any assertion in this file. Made visible to both
    // org units `createRisk` can be called with.
    await makeRiskAssignmentVisible(prisma, { user: owner, orgUnitId: orgUnit.id });
    await grantUnitScopeFixture(prisma, { user: owner, orgUnitId: otherOrgUnit.id });
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function agentWithPermissions(
    permissions: readonly PermissionIdentifier[],
    scopedOrgUnitId: string,
  ): Promise<{ agent: ReturnType<typeof request.agent>; userId: string; role: Role }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('evidence-link-actor')}@example.test`,
      primaryOrgUnitId: scopedOrgUnitId,
    });
    const role = await createRoleWithPermissionsFixture(prisma, permissions, {
      name: `fixture-evidence-link-role-${randomUUID()}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantUnitScopeFixture(prisma, { user: fixture.user, orgUnitId: scopedOrgUnitId });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);

    return { agent, userId: fixture.user.id, role };
  }

  async function createEvidence(
    agent: ReturnType<typeof request.agent>,
    inOrgUnitId: string,
  ): Promise<EvidenceBody> {
    const response = await agent.post('/api/v1/evidence').set('Origin', appOrigin).send({
      orgUnitId: inOrgUnitId,
      title: 'Evidência de teste de vínculo',
      type: 'DOCUMENT',
      source: 'MANUAL_UPLOAD',
      ownerUserId,
      collectedOn: '2026-03-01',
      observation: 'Observação da evidência de teste.',
    });
    expect(response.status).toBe(201);
    return response.body as EvidenceBody;
  }

  async function createRisk(
    agent: ReturnType<typeof request.agent>,
    inOrgUnitId: string,
  ): Promise<RiskBody> {
    const response = await agent.post('/api/v1/risks').set('Origin', appOrigin).send({
      title: 'Risco para teste de vínculo de evidência',
      description: 'Descrição do risco.',
      orgUnitId: inOrgUnitId,
      ownerUserId,
    });
    expect(response.status).toBe(201);
    return response.body as RiskBody;
  }

  /** Broad setup actor — global scope, every permission this suite needs —
   * used only to create fixtures (evidence/risks) across BOTH org units;
   * never the actor under test in an assertion. */
  async function setupActor(): Promise<{ agent: ReturnType<typeof request.agent> }> {
    const prisma = ctx.app.get(PrismaService);
    const fixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('evidence-link-setup')}@example.test`,
    });
    const role = await createRoleWithPermissionsFixture(
      prisma,
      [
        'evidence:create',
        'evidence:view',
        'evidence:administer',
        'evidence:link',
        'risk:create',
        'risk:view',
      ],
      { name: `fixture-evidence-link-setup-role-${randomUUID()}` },
    );
    await assignRoleFixture(prisma, { user: fixture.user, role });
    const { grantGlobalScopeFixture } =
      await import('../integration/support/authorization-fixtures');
    await grantGlobalScopeFixture(prisma, { user: fixture.user });

    const agent = request.agent(ctx.app.getHttpServer());
    const loginResponse = await agent
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    return { agent };
  }

  // -------------------------------------------------------------------
  // linkEvidence — the both-sides guarantee (FR-031, R-001)
  // -------------------------------------------------------------------

  describe('POST /evidence/{evidenceId}/links', () => {
    it('succeeds for a caller holding evidence:link and risk:view, both within scope', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id, note: 'Sustenta a decisão de risco.' });

      expect(response.status).toBe(201);
      const body = response.body as EvidenceLinkBody;
      expect(body.evidenceId).toBe(evidence.id);
      expect(body.subjectType).toBe('RISK');
      expect(body.subjectId).toBe(risk.id);
      expect(body.unlinkedAt).toBeNull();
      expect(body.subjectLabel).toBeTruthy();
    });

    // Phase 6 audit finding: `EvidenceSubjectType.RISK_TREATMENT_DECISION`
    // is registered by `RiskModule` (`RiskTreatmentDecisionEvidenceSubjectAccessor`,
    // T030) and reachable through this exact route in production, but no
    // test anywhere in this suite had ever exercised it end-to-end before
    // this one — only the generic registry mechanism was unit-tested
    // (`test/unit/evidence-subject-resolver-registry.spec.ts`, with a
    // no-op accessor and only `RISK` as its example key). A declared,
    // wired, real subject type with zero exercised coverage is exactly
    // the class of defect this codebase treats seriously (CLAUDE.md
    // §19.10) — closed here rather than merely reported.
    it('links evidence to a RISK_TREATMENT_DECISION subject — the resolver RiskModule registers but no test had exercised end-to-end', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const treatmentActor = await agentWithPermissions(['risk:view', 'risk:treat'], orgUnitId);
      const riskResponse = await treatmentActor.agent
        .get(`/api/v1/risks/${risk.id}`)
        .set('Origin', appOrigin);
      expect(riskResponse.status).toBe(200);
      const decisionResponse = await treatmentActor.agent
        .post(`/api/v1/risks/${risk.id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', riskResponse.headers.etag!)
        .send({ strategy: 'MITIGATE', description: 'Mitigar via controles adicionais.' });
      expect(decisionResponse.status).toBe(201);
      const decisionId = (decisionResponse.body as { id: string }).id;

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({
          subjectType: 'RISK_TREATMENT_DECISION',
          subjectId: decisionId,
          note: 'Sustenta a decisão de tratamento.',
        });

      expect(response.status).toBe(201);
      const body = response.body as EvidenceLinkBody;
      expect(body.subjectType).toBe('RISK_TREATMENT_DECISION');
      expect(body.subjectId).toBe(decisionId);
      expect(body.unlinkedAt).toBeNull();
      // `RiskTreatmentDecisionEvidenceSubjectAccessor` builds this label
      // from the parent risk's code plus the decision's own strategy
      // label — proves the composition (decision -> parent risk scope
      // check -> label), not just that SOME string came back.
      expect(body.subjectLabel).toContain(risk.code);
      expect(body.subjectLabel).toContain('Mitigar');

      const links = await agent
        .get(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin);
      expect(links.status).toBe(200);
      const linkBodies = links.body as readonly EvidenceLinkBody[];
      expect(
        linkBodies.some(
          (link) => link.subjectType === 'RISK_TREATMENT_DECISION' && link.subjectId === decisionId,
        ),
      ).toBe(true);
    });

    // Assurance fix (confirmed breach, FR-030): `resolveViewableSubject`'s
    // propagated `NotFoundDomainError` used to be keyed by
    // `decision.riskId` (the PARENT risk — a different entity, a different
    // label, and a UUID the caller never supplied) rather than by
    // `subjectId` (the decision the caller actually asked about). Asserts
    // byte-identical `type`/`title`/`detail` between an out-of-scope
    // decision and a nonexistent decision id — `detail` specifically,
    // since the sibling RISK-subject test above only ever compared
    // `title`, which is exactly why this slipped through.
    it('adversarial: a RISK_TREATMENT_DECISION whose PARENT risk is out of scope is refused as 404, problem+json byte-identical to a nonexistent decision id', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, otherOrgUnitId);

      const treatmentActor = await agentWithPermissions(
        ['risk:view', 'risk:treat'],
        otherOrgUnitId,
      );
      const riskResponse = await treatmentActor.agent
        .get(`/api/v1/risks/${risk.id}`)
        .set('Origin', appOrigin);
      expect(riskResponse.status).toBe(200);
      const decisionResponse = await treatmentActor.agent
        .post(`/api/v1/risks/${risk.id}/treatments`)
        .set('Origin', appOrigin)
        .set('If-Match', riskResponse.headers.etag!)
        .send({ strategy: 'MITIGATE', description: 'Mitigar via controles adicionais.' });
      expect(decisionResponse.status).toBe(201);
      const decisionId = (decisionResponse.body as { id: string }).id;

      // Holds `risk:view` (so the refusal is a SCOPE failure over the
      // parent risk, not a missing-permission one) but no scope grant over
      // `otherOrgUnitId`, where the risk (and therefore the decision) live.
      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );

      const nonexistentId = randomUUID();
      const outOfScopeResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK_TREATMENT_DECISION', subjectId: decisionId });
      const unknownResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK_TREATMENT_DECISION', subjectId: nonexistentId });

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);

      const outOfScopeBody = outOfScopeResponse.body as {
        readonly type?: string;
        readonly title: string;
        readonly detail?: string;
      };
      const unknownBody = unknownResponse.body as {
        readonly type?: string;
        readonly title: string;
        readonly detail?: string;
      };
      expect(outOfScopeBody.type).toBe(unknownBody.type);
      expect(outOfScopeBody.title).toBe(unknownBody.title);
      // `detail` embeds the id the caller themselves supplied — comparing
      // for bare equality would be wrong (they necessarily differ, since
      // one call supplied the REAL decision id and the other a random
      // one); what FR-030 requires, mirroring
      // `attachment-access.spec.ts`'s identical-class test, is that BOTH
      // follow the IDENTICAL template, keyed by the DECISION's own id —
      // never the parent risk's.
      expect(outOfScopeBody.detail).toBe(
        `Decisão de tratamento de risco ${decisionId} não foi encontrado(a).`,
      );
      expect(unknownBody.detail).toBe(
        `Decisão de tratamento de risco ${nonexistentId} não foi encontrado(a).`,
      );
      // The PARENT risk's id must never appear anywhere in the response.
      expect(JSON.stringify(outOfScopeResponse.body)).not.toContain(risk.id);
    });

    it('refuses a caller lacking evidence:link — 403', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(['evidence:view', 'risk:view'], orgUnitId);
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(response.status).toBe(403);
    });

    it('adversarial: a valid enum with a NONEXISTENT subject id is rejected as 404, not a bare enum-validity pass', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: randomUUID() });
      expect(response.status).toBe(404);
    });

    it('adversarial: a real subject id OUTSIDE the actor scope is refused as 404, byte-identical class to an unknown id', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const outOfScopeRisk = await createRisk(setup, otherOrgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );

      const outOfScopeResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: outOfScopeRisk.id });
      const unknownResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: randomUUID() });

      expect(outOfScopeResponse.status).toBe(404);
      expect(unknownResponse.status).toBe(404);
      expect((outOfScopeResponse.body as { title: string }).title).toBe(
        (unknownResponse.body as { title: string }).title,
      );
    });

    it('adversarial: the actor can see the evidence but NOT the subject (no risk:view at all) — 404', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(['evidence:link', 'evidence:view'], orgUnitId);
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(response.status).toBe(404);
    });

    it('adversarial: the actor can see the subject but NOT the evidence (out of scope) — 404, the reverse case', async () => {
      const { agent: setup } = await setupActor();
      const outOfScopeEvidence = await createEvidence(setup, otherOrgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await agent
        .post(`/api/v1/evidence/${outOfScopeEvidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(response.status).toBe(404);
    });

    it('adversarial: a duplicate ACTIVE link on the same (evidence, subject) pair is rejected — 409', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const first = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(first.status).toBe(201);

      const second = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(second.status).toBe(409);
    });

    it('adversarial: an ARCHIVED evidence may not gain a new link — 422', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);
      const archiveResponse = await setup
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(archiveResponse.status).toBe(200);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(response.status).toBe(422);
    });

    it('adversarial: a permission revoked between two requests takes effect on the very next one — 403', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const riskA = await createRisk(setup, orgUnitId);
      const riskB = await createRisk(setup, orgUnitId);

      const { agent, role } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );

      const firstLink = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: riskA.id });
      expect(firstLink.status).toBe(201);

      // Revoke `evidence:link` via the REAL admin endpoint (bumps
      // `permissionsVersion`, invalidating the cached effective-permission
      // set for every affected user on their very next request — see
      // `permission-resolver.service.ts`'s own header) rather than a raw
      // Prisma delete, which would leave a stale cache entry live and make
      // this test flaky/wrong about what production actually does.
      const { agent: adminAgent } = await (async () => {
        const prisma = ctx.app.get(PrismaService);
        const adminFixture = await createLocalUserFixture(prisma, {
          email: `${uniqueTestMarker('evidence-link-role-admin')}@example.test`,
        });
        const adminRole = await createRoleWithPermissionsFixture(prisma, ['role:administer'], {
          name: `fixture-role-admin-${randomUUID()}`,
        });
        await assignRoleFixture(prisma, { user: adminFixture.user, role: adminRole });
        const { grantGlobalScopeFixture } =
          await import('../integration/support/authorization-fixtures');
        await grantGlobalScopeFixture(prisma, { user: adminFixture.user });
        const adminAgentInstance = request.agent(ctx.app.getHttpServer());
        const loginResponse = await adminAgentInstance
          .post('/api/v1/auth/login')
          .set('Origin', appOrigin)
          .send({ email: adminFixture.user.email, password: adminFixture.rawPassword });
        expect(loginResponse.status).toBe(200);
        return { agent: adminAgentInstance };
      })();

      const revokeResponse = await adminAgent
        .patch(`/api/v1/admin/roles/${role.id}`)
        .set('Origin', appOrigin)
        .send({ permissionIdentifiers: ['evidence:view', 'risk:view'] });
      expect(revokeResponse.status).toBe(200);

      const secondLink = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: riskB.id });
      expect(secondLink.status).toBe(403);
    });

    it('emits a distinct evidence.linked audit event, not a generic evidence.updated', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(linkResponse.status).toBe(201);
      const link = linkResponse.body as EvidenceLinkBody;

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { action: 'evidence.linked', entityId: link.id },
      });
      expect(auditRow).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // unlinkEvidence
  // -------------------------------------------------------------------

  describe('POST /evidence/{evidenceId}/links/{linkId}/unlink', () => {
    it('preserves the row with unlinkedAt/unlinkedBy — never a hard delete', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      const link = linkResponse.body as EvidenceLinkBody;

      const unlinkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links/${link.id}/unlink`)
        .set('Origin', appOrigin);
      expect(unlinkResponse.status).toBe(200);
      const unlinked = unlinkResponse.body as EvidenceLinkBody;
      expect(unlinked.unlinkedAt).not.toBeNull();

      const listResponse = await agent
        .get(`/api/v1/evidence/${evidence.id}/links?includeUnlinked=true`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      const items = listResponse.body as readonly EvidenceLinkBody[];
      expect(items.some((item) => item.id === link.id && item.unlinkedAt !== null)).toBe(true);
    });

    it('emits a distinct evidence.unlinked audit event', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'risk:view'],
        orgUnitId,
      );
      const linkResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      const link = linkResponse.body as EvidenceLinkBody;

      await agent
        .post(`/api/v1/evidence/${evidence.id}/links/${link.id}/unlink`)
        .set('Origin', appOrigin);

      const prisma = ctx.app.get(PrismaService);
      const auditRow = await prisma.client.auditEvent.findFirst({
        where: { action: 'evidence.unlinked', entityId: link.id },
      });
      expect(auditRow).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // SC-004: archival preserves every historical link
  // -------------------------------------------------------------------

  describe('archival preserves links (SC-004, FR-009)', () => {
    it('an evidence linked to two risks keeps both links after archival', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const riskA = await createRisk(setup, orgUnitId);
      const riskB = await createRisk(setup, orgUnitId);

      const { agent } = await agentWithPermissions(
        ['evidence:link', 'evidence:view', 'evidence:administer', 'risk:view'],
        orgUnitId,
      );
      const linkA = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: riskA.id });
      const linkB = await agent
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: riskB.id });
      expect(linkA.status).toBe(201);
      expect(linkB.status).toBe(201);

      const archiveResponse = await agent
        .post(`/api/v1/evidence/${evidence.id}/archive`)
        .set('Origin', appOrigin);
      expect(archiveResponse.status).toBe(200);

      const listResponse = await agent
        .get(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin);
      expect(listResponse.status).toBe(200);
      const items = listResponse.body as readonly EvidenceLinkBody[];
      const ids = items.map((item) => item.id);
      expect(ids).toContain((linkA.body as EvidenceLinkBody).id);
      expect(ids).toContain((linkB.body as EvidenceLinkBody).id);
    });
  });

  // -------------------------------------------------------------------
  // listEvidenceLinks — R-010 visibility filtering
  // -------------------------------------------------------------------

  describe('GET /evidence/{evidenceId}/links (R-010)', () => {
    it('omits a link whose subject is outside the reading caller scope, and the count reflects only what is visible', async () => {
      const { agent: setup } = await setupActor();
      const evidence = await createEvidence(setup, orgUnitId);
      const visibleRisk = await createRisk(setup, orgUnitId);
      const hiddenRisk = await createRisk(setup, otherOrgUnitId);

      const visibleLinkResponse = await setup
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: visibleRisk.id });
      const hiddenLinkResponse = await setup
        .post(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: hiddenRisk.id });
      expect(visibleLinkResponse.status).toBe(201);
      expect(hiddenLinkResponse.status).toBe(201);

      // Reader scoped only to `orgUnitId`: sees the evidence (also in
      // `orgUnitId`) and `visibleRisk`, but not `hiddenRisk`.
      const { agent: reader } = await agentWithPermissions(
        ['evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await reader
        .get(`/api/v1/evidence/${evidence.id}/links`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const items = response.body as readonly EvidenceLinkBody[];

      expect(items).toHaveLength(1);
      expect(items[0]?.subjectId).toBe(visibleRisk.id);
    });
  });

  // -------------------------------------------------------------------
  // GET /evidence?subjectType=&subjectId= — the "evidence panel on a
  // domain screen" read path (SC-001 gap closure), not in the original
  // design contract.
  // -------------------------------------------------------------------

  describe('GET /evidence?subjectType=&subjectId=', () => {
    it('lists only the evidence linked to the given subject, within the caller scope', async () => {
      const { agent: setup } = await setupActor();
      const linkedEvidence = await createEvidence(setup, orgUnitId);
      const unlinkedEvidence = await createEvidence(setup, orgUnitId);
      const risk = await createRisk(setup, orgUnitId);

      const linkResponse = await setup
        .post(`/api/v1/evidence/${linkedEvidence.id}/links`)
        .set('Origin', appOrigin)
        .send({ subjectType: 'RISK', subjectId: risk.id });
      expect(linkResponse.status).toBe(201);

      const { agent: reader } = await agentWithPermissions(
        ['evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await reader
        .get(`/api/v1/evidence?subjectType=RISK&subjectId=${risk.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(200);
      const body = response.body as { items: readonly EvidenceBody[] };
      const ids = body.items.map((item) => item.id);
      expect(ids).toContain(linkedEvidence.id);
      expect(ids).not.toContain(unlinkedEvidence.id);
    });

    it('refuses with 422 when only one of subjectType/subjectId is supplied', async () => {
      const { agent } = await agentWithPermissions(['evidence:view'], orgUnitId);
      const response = await agent
        .get(`/api/v1/evidence?subjectType=RISK`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(422);
    });

    it('a subject outside the caller scope is refused as 404, not a silently empty page', async () => {
      const { agent: setup } = await setupActor();
      const outOfScopeRisk = await createRisk(setup, otherOrgUnitId);

      const { agent: reader } = await agentWithPermissions(
        ['evidence:view', 'risk:view'],
        orgUnitId,
      );
      const response = await reader
        .get(`/api/v1/evidence?subjectType=RISK&subjectId=${outOfScopeRisk.id}`)
        .set('Origin', appOrigin);
      expect(response.status).toBe(404);
    });
  });
});
