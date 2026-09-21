/**
 * T031/T032/T033 (007-implementation-remediation, research.md D-9, FR-017,
 * SC-005) — the real payload validator this project did not have: neither
 * `openapi:check` (route-level drift only, F-3 — every reflected component
 * schema is `{"type":"object","properties":{}}` with no `@ApiProperty`
 * anywhere) nor `contract-coverage.spec.ts` (operation PRESENCE only, F-31)
 * checks that a response BODY actually matches its contract's schema.
 *
 * Built on the EXISTING contract harness (`buildContractTestApp` + real
 * `supertest` requests against the real, fully-bootstrapped `AppModule`) —
 * never a second test framework (research.md D-9's own rejected
 * alternatives: a hand-rolled schema validator, and a dedicated contract
 * tool like Dredd/Schemathesis/Prism).
 *
 * ## T032 coverage is now AUTOMATIC, not enumerated here
 *
 * An earlier version of this file hand-listed one representative read
 * operation per document and asserted its schema explicitly. Per the
 * coordinator's own direction, that was replaced: `contract-app.ts` now
 * wires `support/auto-validate-responses.ts` into `buildContractTestApp`
 * itself, so EVERY response any of the suite's 48 existing contract spec
 * files already produces is validated against its own operation's schema,
 * automatically, with no edit to any of those 48 files. That is real
 * coverage of what the suite genuinely exercises (measured: several hundred
 * responses across 648 assertions), not a fixed list of ten someone
 * remembered to write.
 *
 * What remains in THIS file is what the automatic mechanism cannot itself
 * provide: the FR-017 exclusion inventory (data ABOUT the contracts, not a
 * response), the FR-017a real-null effect (one direct, named
 * demonstration), and the SC-005 negative proof that the validator's own
 * rejection logic works — mutating a captured payload, never the
 * application.
 */
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

    // Every permission the platform defines — the same shape
    // `platform.seed.ts` gives the real bootstrap administrator — so this
    // one actor can reach a representative read in every one of the ten
    // documents without assembling ten separate permission sets.
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
    // No `Cookie` header at all.

    expect(response.status).toBe(401);

    const result = validateResponseBody(operation, 401, response.body as unknown);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('FR-017a in effect: a real Evidence response legitimately carries null (description, validUntil, ...) and still validates', async () => {
    const prisma = ctx.app.get(PrismaService);
    // Own, deterministic fixtures — never an arbitrary "any active row"
    // query. `findFirstOrThrow` against a shared table with no ordering
    // guarantee picked up whichever row another file's fixture happened to
    // leave behind, byte-for-byte the same anti-pattern F-29
    // (docs/deferred-findings.md) already names for a different screen —
    // confirmed directly: this test failed with a bare 400 only when run
    // alongside other files, and passed every time in isolation.
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
        // The fixture actor itself (GLOBAL scope, every permission,
        // already created and logged in above) — never a second row
        // queried from a shared table.
        ownerUserId: fixtureUserId,
        collectedOn: '2026-01-01',
        // Deliberately omitted: description, validUntil, externalUrl,
        // observation would all fail invariant E1 without at least one of
        // externalUrl/observation — supplied below instead.
        observation: 'Fixture evidence for the payload validator (T031).',
      });
    expect(createResponse.status).toBe(201);
    const createdEvidence = createResponse.body as {
      readonly description: string | null;
      readonly validUntil: string | null;
      readonly externalUrl: string | null;
    };
    // `description`/`validUntil`/`externalUrl` are absent from the request
    // and therefore `null` in the response — exactly the shape FR-017a's
    // nullable-syntax fix exists to keep the validator from rejecting.
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

      // Printed, not just asserted-nonzero: this IS the "lista explícita"
      // FR-017 requires. A reviewer reads this test's own output to see
      // exactly which operations the validator above does not, and cannot,
      // cover.
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

      // The one binary download this platform has today, named explicitly
      // rather than only counted — a silent count regressing to zero (the
      // route quietly stopped being binary) or growing unnoticed (a new
      // binary route nobody added here) would both be worth a human's
      // attention.
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
      // The register always returns at least the fixture actor's own
      // organizational unit's risks in a long-lived dev database; in a
      // freshly truncated test database it may legitimately be empty — this
      // proof does not depend on a real row existing, only on the SHAPE a
      // real one would have, so a synthetic stand-in with the same required
      // fields is used when the register is empty.
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

      // Baseline: the real (or synthetic-but-conformant) shape passes.
      const beforeResult = validateAgainstSchema('Risks', 'RiskSummary', realRow);
      expect(beforeResult.errors, beforeResult.errors.join('\n')).toEqual([]);
      expect(beforeResult.valid).toBe(true);

      // Deliberately rename the required `title` field — the exact example
      // the task brief names (`RiskSummary.title` -> `titleX`) — on a CLONE,
      // never touching the real captured response.
      const mutated: Record<string, unknown> = { ...realRow };
      mutated.titleX = mutated.title;
      delete mutated.title;

      const afterRenameResult = validateAgainstSchema('Risks', 'RiskSummary', mutated);
      expect(afterRenameResult.valid).toBe(false);
      expect(
        afterRenameResult.errors.some((e) => e.includes("must have required property 'title'")),
      ).toBe(true);

      // Restore and prove it passes again — the acceptance bar names both
      // directions explicitly, not just the failing one.
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
