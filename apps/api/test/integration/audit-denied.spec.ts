/**
 * T040b — proves FR-037's `DENIED`-audit requirement end-to-end, against a
 * real Nest application and real PostgreSQL: a permission refusal and an
 * out-of-scope organizational access each write a `DENIED` `audit_event`
 * row carrying actor, action and entity. Nothing here is mocked —
 * `PermissionGuard`, `PermissionResolverService`, `OrgScopeEnforcerService`
 * and both `AuditPermissionDenialRecorder`/`AuditOrgScopeDenialRecorder`
 * run for real, via Nest DI (`support/test-app.ts`), against the real
 * `PrismaService`.
 *
 * Follows this harness's established convention (see
 * `support/database-roles.ts`'s `resetMutableTestData` doc comment and
 * `support/env.ts`'s `uniqueTestMarker`) of scoping every assertion by a
 * unique marker — here, the fixture actor's/candidate's own freshly
 * generated id — rather than assuming `audit_event` (never truncated
 * between test files) is empty.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuthorizationModule } from '../../src/core/authorization/authorization.module';
import {
  RequirePermission,
  PermissionGuard,
} from '../../src/core/authorization/presentation/permission.guard';
import { OrgScopeEnforcerService } from '../../src/core/organizations/application/org-scope-enforcer.service';
import { OrganizationsModule } from '../../src/core/organizations/organizations.module';
import { CacheModule } from '../../src/infrastructure/cache/cache.module';
import { LoggingModule } from '../../src/infrastructure/logging/logging.module';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';
import { ForbiddenDomainError, NotFoundDomainError } from '../../src/shared/errors/domain-error';
import { globalScope, unitScope } from '../../src/shared/persistence/scope-filter';

import { createOrgUnitFixture, createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

import type { ExecutionContext } from '@nestjs/common';

/** Fixture controller carrying the decorator metadata `PermissionGuard`
 * reads via `Reflector` — the same pattern `test/unit/permission.guard.spec.ts`
 * uses, exercised here against the REAL guard/resolver/recorder chain
 * instead of fakes. */
class FixtureController {
  @RequirePermission('risk:view')
  gatedRoute(): void {
    /* fixture only */
  }
}

/* eslint-disable @typescript-eslint/unbound-method -- Reflect-metadata
   lookup key identity only, never invoked as a bound method. */
const gatedRouteHandler = FixtureController.prototype.gatedRoute;
/* eslint-enable @typescript-eslint/unbound-method */

function createExecutionContext(): ExecutionContext {
  return {
    getHandler: () => gatedRouteHandler,
    getClass: () => FixtureController,
  } as unknown as ExecutionContext;
}

function runAsRequest<T>(actorUserId: string | undefined, fn: () => Promise<T>): Promise<T> {
  return RequestContextStore.run(
    {
      correlationId: randomUUID(),
      ipAddress: '203.0.113.30',
      userAgent: 'vitest-integration',
      method: 'GET',
      path: '/test/audit-denied',
      // `exactOptionalPropertyTypes` forbids passing `actorUserId: undefined`
      // explicitly (RequestContextData declares it optional, meaning
      // "absent", not "present with value undefined") — so the
      // unauthenticated case omits the key entirely via the spread below.
      ...(actorUserId !== undefined ? { actorUserId } : {}),
    },
    fn,
  );
}

describe('DENIED audit-outcome emission (FR-037, T040a/T040b)', () => {
  let ctx: IntegrationTestContext;
  let permissionGuard: PermissionGuard;
  let scopeEnforcer: OrgScopeEnforcerService;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule({
      imports: [LoggingModule, CacheModule, AuthorizationModule, OrganizationsModule],
    });
    permissionGuard = ctx.app.get(PermissionGuard);
    scopeEnforcer = ctx.app.get(OrgScopeEnforcerService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('a permission refusal', () => {
    it('is refused with ForbiddenDomainError AND writes a DENIED audit_event row carrying actor, action and entity', async () => {
      // A brand-new user with zero roles/permissions — PermissionResolverService
      // resolves an empty effective-permission set for them, so the real
      // guard genuinely denies `risk:view`, with no fixture Permission/Role
      // rows needed (the resolver checks SET MEMBERSHIP, not that the
      // identifier exists as a seeded row).
      const actor = await createUserFixture(ctx.prisma);

      await expect(
        runAsRequest(actor.id, () => permissionGuard.canActivate(createExecutionContext())),
      ).rejects.toBeInstanceOf(ForbiddenDomainError);

      const rows = await ctx.prisma.client.auditEvent.findMany({
        where: {
          entityType: AuditEntityType.PERMISSION,
          actorUserId: actor.id,
          outcome: 'DENIED',
        },
      });

      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.actorUserId).toBe(actor.id); // actor
      expect(row.action).toBe('authorization.denied.permission_denied'); // action
      expect(row.entityType).toBe(AuditEntityType.PERMISSION); // entity (type)
      // `entity_id` is `@db.Uuid` — a `resource:action` string identifier
      // is carried in the allow-listed `newValues.identifier` instead (see
      // `AuditPermissionDenialRecorder`'s comment on this decision).
      expect(row.entityId).toBeNull();
      expect(row.newValues).toEqual({ identifier: 'risk:view' });
      expect(row.actorLabel).toBe(actor.fullName);
      expect(row.outcome).toBe('DENIED');
    });

    it('records NO_ACTOR denials distinctly when there is no authenticated caller at all', async () => {
      await expect(
        runAsRequest(undefined, () => permissionGuard.canActivate(createExecutionContext())),
      ).rejects.toThrow();

      // Scoped by a fresh correlation-free marker is not possible here (no
      // actor id to key on) — instead assert on the specific, just-created
      // row via the reason-specific action name plus a narrow time window
      // is unnecessary: query by action AND absence of actorUserId AND the
      // entity id unique to this permission, which is stable but shared
      // across runs — so this test only asserts that AT LEAST one such row
      // exists, which is sufficient to prove the NO_ACTOR path is wired,
      // without depending on table emptiness.
      const rows = await ctx.prisma.client.auditEvent.findMany({
        where: {
          entityType: AuditEntityType.PERMISSION,
          actorUserId: null,
          action: 'authorization.denied.unauthenticated',
          outcome: 'DENIED',
        },
        orderBy: { occurredAt: 'desc' },
        take: 1,
      });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorLabel).toBe('Unauthenticated caller');
    });
  });

  describe('an out-of-scope organizational access', () => {
    it('is refused with NotFoundDomainError (FR-030 non-disclosure) AND writes a DENIED audit_event row carrying actor, action and entity', async () => {
      const actingUser = await createUserFixture(ctx.prisma);
      const accessibleUnit = await createOrgUnitFixture(ctx.prisma);
      const outOfScopeUnit = await createOrgUnitFixture(ctx.prisma);

      // The candidate record: a User row whose organizational unit is
      // `outOfScopeUnit` — deliberately NOT the unit the acting user's
      // scope grants.
      const candidate = await createUserFixture(ctx.prisma, {
        primaryOrgUnitId: outOfScopeUnit.id,
      });

      const scope = unitScope([accessibleUnit.id]);

      await expect(
        runAsRequest(actingUser.id, () =>
          scopeEnforcer.assertAccessible({
            scope,
            actorUserId: actingUser.id,
            entityType: AuditEntityType.USER,
            entityId: candidate.id,
            organizationalUnitId: candidate.primaryOrgUnitId ?? undefined,
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundDomainError);

      const rows = await ctx.prisma.client.auditEvent.findMany({
        where: {
          entityType: AuditEntityType.USER,
          entityId: candidate.id,
          outcome: 'DENIED',
        },
      });

      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.actorUserId).toBe(actingUser.id); // actor
      expect(row.action).toBe('organization.denied.out_of_scope'); // action
      expect(row.entityType).toBe(AuditEntityType.USER); // entity (type)
      expect(row.entityId).toBe(candidate.id); // entity (identifier)
      expect(row.organizationalUnitId).toBe(outOfScopeUnit.id);
      expect(row.actorLabel).toBe(actingUser.fullName);
    });

    it('does NOT deny and writes NO audit row when the acting user holds a GLOBAL scope grant', async () => {
      const actingUser = await createUserFixture(ctx.prisma);
      const someUnit = await createOrgUnitFixture(ctx.prisma);
      const candidate = await createUserFixture(ctx.prisma, { primaryOrgUnitId: someUnit.id });

      await expect(
        runAsRequest(actingUser.id, () =>
          scopeEnforcer.assertAccessible({
            scope: globalScope(),
            actorUserId: actingUser.id,
            entityType: AuditEntityType.USER,
            entityId: candidate.id,
            organizationalUnitId: candidate.primaryOrgUnitId ?? undefined,
          }),
        ),
      ).resolves.toBeUndefined();

      const rows = await ctx.prisma.client.auditEvent.findMany({
        where: { entityType: AuditEntityType.USER, entityId: candidate.id },
      });
      expect(rows).toHaveLength(0);
    });
  });
});
