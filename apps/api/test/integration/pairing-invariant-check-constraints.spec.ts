import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppRolePrismaClient } from './support/database-roles';
import { uniqueTestMarker } from './support/env';

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function expectCheckViolation(error: unknown, constraintName: string): void {
  expect(isPrismaKnownRequestError(error)).toBe(true);
  if (!isPrismaKnownRequestError(error)) throw error;
  expect(error.meta?.code).toBe('23514');
  expect(String(error.meta?.message)).toContain(constraintName);
}

describe('Pairing invariant CHECK constraints (Fix 5, additive migration)', () => {
  let client: PrismaClient;
  let orgUnitId: string;
  let userId: string;

  beforeAll(async () => {
    client = createAppRolePrismaClient();

    const orgUnit = await client.organizationalUnit.create({
      data: {
        id: randomUUID(),
        code: uniqueTestMarker('pairing-check-org'),
        name: 'Fixture Organizational Unit',
        path: '/',
        depth: 0,
      },
    });
    orgUnitId = orgUnit.id;

    const user = await client.user.create({
      data: {
        id: randomUUID(),
        email: `${uniqueTestMarker('pairing-check-user')}@example.test`,
        fullName: 'Fixture User',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  describe('evidence — Invariant E3 (archived_at / archived_by_user_id)', () => {
    it('rejects archived_at set without archived_by_user_id', async () => {
      const evidence = await client.evidence.create({
        data: {
          id: randomUUID(),
          code: uniqueTestMarker('EVD-PAIR'),
          orgUnitId,
          title: 'Fixture evidence',
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId: userId,
          collectedOn: new Date('2026-01-01'),
          observation: 'Fixture observation, satisfies Invariant E1.',
        },
      });

      const error = await client
        .$executeRawUnsafe(
          `UPDATE evidence SET archived_at = now() WHERE id = $1::uuid`,
          evidence.id,
        )
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'evidence_archived_pair_check');

      const unchanged = await client.evidence.findUniqueOrThrow({ where: { id: evidence.id } });
      expect(unchanged.archivedAt).toBeNull();
    });
  });

  describe('evidence_links — Invariant L2 (unlinked_at / unlinked_by_user_id)', () => {
    it('rejects unlinked_by_user_id set without unlinked_at', async () => {
      const evidence = await client.evidence.create({
        data: {
          id: randomUUID(),
          code: uniqueTestMarker('EVD-LINK-PAIR'),
          orgUnitId,
          title: 'Fixture evidence for a link',
          type: 'DOCUMENT',
          source: 'MANUAL_UPLOAD',
          ownerUserId: userId,
          collectedOn: new Date('2026-01-01'),
          observation: 'Fixture observation.',
        },
      });
      const link = await client.evidenceLink.create({
        data: {
          id: randomUUID(),
          evidenceId: evidence.id,
          subjectType: 'RISK',
          subjectId: randomUUID(),
          linkedAt: new Date(),
          linkedByUserId: userId,
        },
      });

      const error = await client
        .$executeRawUnsafe(
          `UPDATE evidence_links SET unlinked_by_user_id = $2::uuid WHERE id = $1::uuid`,
          link.id,
          userId,
        )
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'evidence_links_unlinked_pair_check');

      const unchanged = await client.evidenceLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(unchanged.unlinkedByUserId).toBeNull();
    });
  });

  describe('actions — Invariant A1 (completed_at / completed_by_user_id, and status <=> completed_at)', () => {
    async function createOpenAction(): Promise<{ id: string }> {
      return client.action.create({
        data: {
          id: randomUUID(),
          code: uniqueTestMarker('ACT-PAIR'),
          orgUnitId,
          originType: 'RISK_TREATMENT',
          originId: randomUUID(),
          title: 'Fixture action',
          responsibleUserId: userId,
          dueOn: new Date('2026-05-01'),
        },
      });
    }

    it('rejects completed_by_user_id set without completed_at (leaving status OPEN, so the status<=>completed_at check is not what fires)', async () => {
      const action = await createOpenAction();

      const error = await client
        .$executeRawUnsafe(
          `UPDATE actions SET completed_by_user_id = $2::uuid WHERE id = $1::uuid`,
          action.id,
          userId,
        )
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'actions_completed_pair_check');

      const unchanged = await client.action.findUniqueOrThrow({ where: { id: action.id } });
      expect(unchanged.completedByUserId).toBeNull();
      expect(unchanged.status).toBe('OPEN');
    });

    it('rejects status = COMPLETED with completed_at left null (the pairing alone is satisfied — both null — only the status equivalence is violated)', async () => {
      const action = await createOpenAction();

      const error = await client
        .$executeRawUnsafe(`UPDATE actions SET status = 'COMPLETED' WHERE id = $1::uuid`, action.id)
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'actions_completed_status_check');

      const unchanged = await client.action.findUniqueOrThrow({ where: { id: action.id } });
      expect(unchanged.status).toBe('OPEN');
    });

    it('rejects reopened_at set without reopened_by_user_id', async () => {
      const action = await createOpenAction();

      const error = await client
        .$executeRawUnsafe(`UPDATE actions SET reopened_at = now() WHERE id = $1::uuid`, action.id)
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'actions_reopened_pair_check');

      const unchanged = await client.action.findUniqueOrThrow({ where: { id: action.id } });
      expect(unchanged.reopenedAt).toBeNull();
    });
  });

  describe('findings — closed_at/closed_by_user_id and archived_at/archived_by_user_id pairings', () => {
    async function createOpenFinding(): Promise<{ id: string }> {
      return client.finding.create({
        data: {
          id: randomUUID(),
          code: uniqueTestMarker('FND-PAIR'),
          orgUnitId,
          title: 'Fixture finding',
          description: 'Fixture description.',
          category: 'OBSERVATION',
          origin: 'INTERNAL_ASSESSMENT',
          severity: 'LOW',
          priority: 'LOW',
          ownerUserId: userId,
          identifiedOn: new Date('2026-01-01'),
        },
      });
    }

    it('rejects closed_by_user_id set without closed_at', async () => {
      const finding = await createOpenFinding();

      const error = await client
        .$executeRawUnsafe(
          `UPDATE findings SET closed_by_user_id = $2::uuid WHERE id = $1::uuid`,
          finding.id,
          userId,
        )
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'findings_closed_pair_check');

      const unchanged = await client.finding.findUniqueOrThrow({ where: { id: finding.id } });
      expect(unchanged.closedByUserId).toBeNull();
    });

    it('rejects archived_by_user_id set without archived_at', async () => {
      const finding = await createOpenFinding();

      const error = await client
        .$executeRawUnsafe(
          `UPDATE findings SET archived_by_user_id = $2::uuid WHERE id = $1::uuid`,
          finding.id,
          userId,
        )
        .catch((caught: unknown) => caught);

      expectCheckViolation(error, 'findings_archived_pair_check');

      const unchanged = await client.finding.findUniqueOrThrow({ where: { id: finding.id } });
      expect(unchanged.archivedByUserId).toBeNull();
    });
  });
});
