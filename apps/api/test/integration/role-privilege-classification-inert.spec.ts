import { randomUUID } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { buildContractTestApp, type ContractTestContext } from '../contract/support/contract-app';

import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
} from './support/authorization-fixtures';
import { uniqueTestMarker } from './support/env';
import { createLocalUserFixture } from './support/fixtures';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

const API_PREFIX = '/api/v1';
const RISK_LIST = `${API_PREFIX}/risks`;
const RISK_CREATE = `${API_PREFIX}/risks`;

const GOVERNANCE_PERMISSIONS: readonly PermissionIdentifier[] = [
  'role:administer',
  'user:administer',
  'org_unit:administer',
];

describe('ADR-021 — the privilege classification changes no decision (015 FR-036, STATE §16.1 item 2)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let classifiedAgent: ReturnType<typeof request.agent>;
  let unclassifiedAgent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    appOrigin = ctx.app.get(AppConfigService).app.appOrigin;
    const prisma = ctx.app.get(PrismaService);

    async function agentHolding(
      marker: string,
      identifiers: readonly PermissionIdentifier[],
    ): Promise<ReturnType<typeof request.agent>> {
      const role = await createRoleWithPermissionsFixture(prisma, identifiers, {
        name: `fixture-${marker}-${randomUUID()}`,
      });
      const user = await createLocalUserFixture(prisma, {
        email: `${uniqueTestMarker(marker)}@example.test`,
      });
      await assignRoleFixture(prisma, { user: user.user, role });

      const agent = request.agent(ctx.app.getHttpServer());
      const login = await agent
        .post(`${API_PREFIX}/auth/login`)
        .set('Origin', appOrigin)
        .send({ email: user.user.email, password: user.rawPassword });
      expect(login.status).toBe(200);
      return agent;
    }

    classifiedAgent = await agentHolding('privileged-role', [
      ...GOVERNANCE_PERMISSIONS,
      'risk:view',
    ]);
    unclassifiedAgent = await agentHolding('plain-role', ['risk:view', 'risk:create']);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('gives each identity exactly the permissions granted to it — no classification widens either set', async () => {
    const classified = await classifiedAgent
      .get(`${API_PREFIX}/auth/session`)
      .set('Origin', appOrigin);
    const unclassified = await unclassifiedAgent
      .get(`${API_PREFIX}/auth/session`)
      .set('Origin', appOrigin);
    expect(classified.status).toBe(200);
    expect(unclassified.status).toBe(200);

    const classifiedPermissions = [
      ...((classified.body as { permissions: readonly string[] }).permissions ?? []),
    ].sort();
    const unclassifiedPermissions = [
      ...((unclassified.body as { permissions: readonly string[] }).permissions ?? []),
    ].sort();

    expect(classifiedPermissions).toEqual(
      ['risk:view', ...GOVERNANCE_PERMISSIONS].sort((a, b) => a.localeCompare(b)),
    );
    expect(unclassifiedPermissions).toEqual(['risk:create', 'risk:view']);
  });

  it('answers the same for both on a route gated by a permission BOTH hold (risk:view)', async () => {
    const classified = await classifiedAgent.get(RISK_LIST).set('Origin', appOrigin);
    const unclassified = await unclassifiedAgent.get(RISK_LIST).set('Origin', appOrigin);

    expect(classified.status).toBe(unclassified.status);
    expect(classified.status).not.toBe(403);
  });

  it('refuses the CLASSIFIED identity a permission it does not hold, and allows the UNCLASSIFIED one the same permission it does (risk:create)', async () => {
    const classified = await classifiedAgent.post(RISK_CREATE).set('Origin', appOrigin).send({});
    const unclassified = await unclassifiedAgent
      .post(RISK_CREATE)
      .set('Origin', appOrigin)
      .send({});

    expect(classified.status).toBe(403);

    expect(unclassified.status).toBe(400);
  });
});
