/**
 * T031 — proves `AuditRecorder` writes inside the CALLER's transaction
 * (ADR-005), against a real Nest application and real PostgreSQL:
 *
 *   - a business change and its audit entry commit together;
 *   - when the surrounding transaction rolls back, the audit entry is
 *     ABSENT too — this is the assertion that actually proves ADR-005
 *     (the happy-path commit case alone would pass even for a
 *     fire-and-forget/best-effort audit implementation; only the rollback
 *     case rules that out).
 *   - calling `AuditRecorder.record(...)` with no ambient transaction at
 *     all fails loudly instead of writing a standalone, unaudited-by-
 *     rollback row.
 *
 * Each test exercises the REAL `PrismaService.runInTransaction` and the
 * REAL `PrismaAuditEventWriter` (via Nest DI, `support/test-app.ts`) —
 * nothing here is mocked. A `User` row is used as the "business change"
 * because it is the only table already in the schema this phase may
 * write to; the mechanism being proven (one transaction, two writes) is
 * identical for any future entity type.
 */
import { randomUUID } from 'node:crypto';

import { AuditEntityType } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import { RequestContextStore } from '../../src/infrastructure/logging/request-context';

import { createUserFixture } from './support/fixtures';
import { buildIntegrationTestingModule, type IntegrationTestContext } from './support/test-app';

class DeliberateFailureAfterAudit extends Error {}

describe('AuditRecorder — transactional coupling (ADR-005, T031)', () => {
  let ctx: IntegrationTestContext;
  let auditRecorder: AuditRecorder;

  beforeAll(async () => {
    ctx = await buildIntegrationTestingModule();
    auditRecorder = ctx.app.get(AuditRecorder);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('commits the audit row together with the change it describes', async () => {
    const user = await createUserFixture(ctx.prisma);
    const newJobTitle = `committed-${randomUUID()}`;

    await RequestContextStore.run(
      {
        correlationId: randomUUID(),
        ipAddress: '203.0.113.10',
        userAgent: 'vitest-integration',
        method: 'POST',
        path: '/test/audit-transactional',
        actorUserId: user.id,
      },
      () =>
        ctx.prisma.runInTransaction(async () => {
          await ctx.prisma.client.user.update({
            where: { id: user.id },
            data: { jobTitle: newJobTitle },
          });

          await auditRecorder.record({
            action: 'user.job_title_changed',
            entityType: AuditEntityType.USER,
            entityId: user.id,
            actorLabel: user.fullName,
            newValues: { jobTitle: newJobTitle },
          });
        }),
    );

    const updatedUser = await ctx.prisma.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.jobTitle).toBe(newJobTitle);

    const auditRows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.USER,
        entityId: user.id,
        action: 'user.job_title_changed',
      },
    });

    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.actorUserId).toBe(user.id);
    expect(auditRows[0]?.actorLabel).toBe(user.fullName);
    expect(auditRows[0]?.newValues).toEqual({ jobTitle: newJobTitle });
    expect(auditRows[0]?.outcome).toBe('SUCCESS');
  });

  it('leaves NO audit row when the surrounding transaction rolls back — the assertion that proves ADR-005', async () => {
    const user = await createUserFixture(ctx.prisma);
    const attemptedJobTitle = `rolled-back-${randomUUID()}`;

    await expect(
      RequestContextStore.run(
        {
          correlationId: randomUUID(),
          ipAddress: '203.0.113.20',
          userAgent: 'vitest-integration',
          method: 'POST',
          path: '/test/audit-transactional',
          actorUserId: user.id,
        },
        () =>
          ctx.prisma.runInTransaction(async () => {
            await ctx.prisma.client.user.update({
              where: { id: user.id },
              data: { jobTitle: attemptedJobTitle },
            });

            // The audit call itself succeeds and issues its INSERT here —
            // proving this case is not merely "the audit call was never
            // reached". The failure that rolls everything back happens
            // strictly AFTER it, exactly like a downstream business rule
            // failing later in the same use case.
            await auditRecorder.record({
              action: 'user.job_title_changed',
              entityType: AuditEntityType.USER,
              entityId: user.id,
              actorLabel: user.fullName,
              newValues: { jobTitle: attemptedJobTitle },
            });

            throw new DeliberateFailureAfterAudit('simulated failure after the audit call');
          }),
      ),
    ).rejects.toThrow(DeliberateFailureAfterAudit);

    const unchangedUser = await ctx.prisma.client.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(unchangedUser.jobTitle).not.toBe(attemptedJobTitle);

    const auditRows = await ctx.prisma.client.auditEvent.findMany({
      where: {
        entityType: AuditEntityType.USER,
        entityId: user.id,
        action: 'user.job_title_changed',
      },
    });

    // The audit INSERT that ran inside the rolled-back transaction left no
    // trace at all — not "marked failed", not "present but orphaned":
    // absent, exactly as if it had never been issued.
    expect(auditRows).toHaveLength(0);
  });

  it('refuses to write — loudly — when called with no ambient transaction at all', async () => {
    const user = await createUserFixture(ctx.prisma);

    await expect(
      auditRecorder.record({
        action: 'user.job_title_changed',
        entityType: AuditEntityType.USER,
        entityId: user.id,
        actorLabel: user.fullName,
      }),
    ).rejects.toThrow(/active PrismaService transaction/);

    const auditRows = await ctx.prisma.client.auditEvent.findMany({
      where: { entityType: AuditEntityType.USER, entityId: user.id },
    });
    expect(auditRows).toHaveLength(0);
  });
});
