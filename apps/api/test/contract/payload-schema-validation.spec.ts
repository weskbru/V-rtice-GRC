import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppConfigService } from '../../src/infrastructure/config/app-config.service';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';
import {
  assignRoleFixture,
  createRoleWithPermissionsFixture,
  grantGlobalScopeFixture,
} from '../integration/support/authorization-fixtures';
import { uniqueTestMarker } from '../integration/support/env';
import {
  createLocalUserFixture,
  createOrgUnitFixture,
  type LocalUserFixture,
} from '../integration/support/fixtures';

import { buildContractTestApp } from './support/contract-app';
import { buildBodyExclusionInventory, findOperation } from './support/openapi-documents';
import { validateAgainstSchema, validateResponseBody } from './support/payload-validator';

import type { ContractTestContext } from './support/contract-app';
import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';

describe('Payload schema validation (T031/T032/T033, FR-017, SC-005)', () => {
  let ctx: ContractTestContext;
  let appOrigin: string;
  let cookieHeader: string;
  let fixtureUserId: string;

  beforeAll(async () => {
    ctx = await buildContractTestApp();
    const appConfig = ctx.app.get(AppConfigService);
    appOrigin = appConfig.app.appOrigin;

    const prisma = ctx.app.get(PrismaService);
    const fixture: LocalUserFixture = await createLocalUserFixture(prisma, {
      email: `${uniqueTestMarker('payload-validator')}@example.test`,
    });
    fixtureUserId = fixture.user.id;

    const everyPermission = getAllPermissionDefinitions().map(
      (d) => d.identifier as PermissionIdentifier,
    );
    const role = await createRoleWithPermissionsFixture(prisma, everyPermission, {
      name: `fixture-payload-validator-role-${uniqueTestMarker('role')}`,
    });
    await assignRoleFixture(prisma, { user: fixture.user, role });
    await grantGlobalScopeFixture(prisma, { user: fixture.user });

    const loginResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', appOrigin)
      .send({ email: fixture.user.email, password: fixture.rawPassword });
    expect(loginResponse.status).toBe(200);
    const setCookie = loginResponse.headers['set-cookie'] as unknown as string[];
    cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('an unauthenticated request produces a problem+json body matching ProblemDetails-shaped schemas (401)', async () => {
    const operation = findOperation('GrcFoundation', 'listEvidence');
    const response = await request(ctx.app.getHttpServer())
      .get('/api/v1/evidence')
      .set('Origin', appOrigin);

    expect(response.status).toBe(401);

    const result = validateResponseBody(operation, 401, response.body as unknown);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('FR-017a in effect: a real Evidence response legitimately carries null (description, validUntil, ...) and still validates', async () => {
    const prisma = ctx.app.get(PrismaService);
    const orgUnit = await createOrgUnitFixture(prisma, {
      name: `Fixture org unit for payload validator (${uniqueTestMarker('org')})`,
    });

    const createResponse = await request(ctx.app.getHttpServer())
      .post('/api/v1/evidence')
      .set('Origin', appOrigin)
      .set('Cookie', cookieHeader)
      .send({
        orgUnitId: orgUnit.id,
        title: `${uniqueTestMarker('payload-validator-evidence')}`,
        type: 'DOCUMENT',
        source: 'MANUAL_UPLOAD',
        ownerUserId: fixtureUserId,
        collectedOn: '2026-01-01',
        observation: 'Fixture evidence for the payload validator (T031).',
      });
    expect(createResponse.status).toBe(201);
    const createdEvidence = createResponse.body as {
      readonly description: string | null;
      readonly validUntil: string | null;
      readonly externalUrl: string | null;
    };
    expect(createdEvidence.description).toBeNull();
    expect(createdEvidence.validUntil).toBeNull();
    expect(createdEvidence.externalUrl).toBeNull();

    const operation = findOperation('GrcFoundation', 'createEvidence');
    const result = validateResponseBody(operation, 201, createdEvidence);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  describe('FR-017 exclusion inventory (documented, not omitted)', () => {
    it('every bodyless and binary-response operation across the ten contracts is accounted for', () => {
      const inventory = buildBodyExclusionInventory();

      console.log(
        'No response body at all (nothing to validate):\n' +
          inventory.noBody
            .map(
              (op) =>
                `  ${op.documentKey}: ${op.method.toUpperCase()} ${op.path} (${op.operationId})`,
            )
            .join('\n'),
      );
      console.log(
        "Binary/non-JSON success body (out of a JSON Schema validator's scope by definition):\n" +
          inventory.binary
            .map(
              (op) =>
                `  ${op.documentKey}: ${op.method.toUpperCase()} ${op.path} (${op.operationId})`,
            )
            .join('\n'),
      );

      expect(inventory.binary.map((op) => op.operationId)).toEqual(['downloadAttachmentContent']);
      expect(inventory.noBody.length).toBeGreaterThan(0);
    });
  });

  describe('SC-005 — negative proof: the validator rejects a renamed/removed field', () => {
    it('rejects RiskSummary.title renamed to titleX, and passes again once restored', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/v1/risks')
        .set('Origin', appOrigin)
        .set('Cookie', cookieHeader);
      expect(response.status).toBe(200);

      const rows = (response.body as { data: readonly Record<string, unknown>[] }).data;
      const realRow: Record<string, unknown> = rows[0] ?? {
        id: '00000000-0000-0000-0000-000000000000',
        code: 'RSK-0000-0000',
        title: 'Synthetic row (empty register)',
        status: 'DRAFT',
        orgUnit: {
          id: '00000000-0000-0000-0000-000000000000',
          code: 'FIXTURE',
          name: 'Fixture',
        },
        owner: { id: '00000000-0000-0000-0000-000000000000', fullName: 'Fixture Owner' },
        overdueReview: false,
        overdueTreatment: false,
        pendingApproval: false,
        version: 1,
      };

      const beforeResult = validateAgainstSchema('Risks', 'RiskSummary', realRow);
      expect(beforeResult.errors, beforeResult.errors.join('\n')).toEqual([]);
      expect(beforeResult.valid).toBe(true);

      const mutated: Record<string, unknown> = { ...realRow };
      mutated.titleX = mutated.title;
      delete mutated.title;

      const afterRenameResult = validateAgainstSchema('Risks', 'RiskSummary', mutated);
      expect(afterRenameResult.valid).toBe(false);
      expect(
        afterRenameResult.errors.some((e) => e.includes("must have required property 'title'")),
      ).toBe(true);

      const restored: Record<string, unknown> = { ...mutated };
      restored.title = restored.titleX;
      delete restored.titleX;
      const restoredResult = validateAgainstSchema('Risks', 'RiskSummary', restored);
      expect(restoredResult.errors, restoredResult.errors.join('\n')).toEqual([]);
      expect(restoredResult.valid).toBe(true);
    });

    it('rejects a value outside its declared enum', () => {
      const mutated = {
        id: '00000000-0000-0000-0000-000000000000',
        code: 'RSK-0000-0000',
        title: 'Fixture',
        status: 'NOT_A_REAL_STATUS',
        orgUnit: { id: '00000000-0000-0000-0000-000000000000', code: 'FIXTURE', name: 'Fixture' },
        owner: { id: '00000000-0000-0000-0000-000000000000', fullName: 'Fixture Owner' },
        overdueReview: false,
        overdueTreatment: false,
        pendingApproval: false,
        version: 1,
      };
      const result = validateAgainstSchema('Risks', 'RiskSummary', mutated);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('must be equal to one of the allowed values')),
      ).toBe(true);
    });

    it('rejects an undeclared null on a non-nullable required field', () => {
      const mutated = {
        id: '00000000-0000-0000-0000-000000000000',
        code: 'RSK-0000-0000',
        title: null,
        status: 'DRAFT',
        orgUnit: { id: '00000000-0000-0000-0000-000000000000', code: 'FIXTURE', name: 'Fixture' },
        owner: { id: '00000000-0000-0000-0000-000000000000', fullName: 'Fixture Owner' },
        overdueReview: false,
        overdueTreatment: false,
        pendingApproval: false,
        version: 1,
      };
      const result = validateAgainstSchema('Risks', 'RiskSummary', mutated);
      expect(result.valid).toBe(false);
    });
  });
});
