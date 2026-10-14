import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppRolePrismaClient, createOwnerRolePrismaClient } from './support/database-roles';
import { uniqueTestMarker } from './support/env';

function isPrismaKnownRequestError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

describe('audit_event append-only enforcement (FR-034, ADR-005, T032)', () => {
  let appClient: PrismaClient;
  let ownerClient: PrismaClient;
  let probeId: string;
  let probeAction: string;

  beforeAll(async () => {
    appClient = createAppRolePrismaClient();
    ownerClient = createOwnerRolePrismaClient();

    probeId = randomUUID();
    probeAction = uniqueTestMarker('probe.append-only');

    await appClient.auditEvent.create({
      data: {
        id: probeId,
        occurredAt: new Date(),
        actorLabel: 'append-only-probe',
        action: probeAction,
        entityType: 'USER',
        correlationId: randomUUID(),
        outcome: 'SUCCESS',
      },
    });
  });

  afterAll(async () => {
    await appClient.$disconnect();
    await ownerClient.$disconnect();
  });

  describe('as vertice_app — the restricted role the running application always uses', () => {
    it('rejects UPDATE with a privilege-denied error (SQLSTATE 42501), never reaching the trigger', async () => {
      const error = await appClient
        .$executeRawUnsafe(
          `UPDATE audit_event SET action = $1 WHERE id = $2::uuid`,
          'tampered',
          probeId,
        )
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;

      expect(error.meta?.code).toBe('42501');
      expect(String(error.meta?.message)).not.toMatch(/append-only/i);
    });

    it('rejects DELETE with a privilege-denied error (SQLSTATE 42501), never reaching the trigger', async () => {
      const error = await appClient
        .$executeRawUnsafe(`DELETE FROM audit_event WHERE id = $1::uuid`, probeId)
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;

      expect(error.meta?.code).toBe('42501');
      expect(String(error.meta?.message)).not.toMatch(/append-only/i);
    });
  });

  describe('as vertice_owner — the migration/owner role; the trigger backstop', () => {
    it('rejects UPDATE via the BEFORE UPDATE trigger even though the owner holds full table privileges', async () => {
      const error = await ownerClient
        .$executeRawUnsafe(
          `UPDATE audit_event SET action = $1 WHERE id = $2::uuid`,
          'tampered',
          probeId,
        )
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;

      expect(String(error.meta?.message)).toMatch(
        /audit_event is append-only: UPDATE is not permitted \(FR-034\)/,
      );
    });

    it('rejects DELETE via the BEFORE DELETE trigger even though the owner holds full table privileges', async () => {
      const error = await ownerClient
        .$executeRawUnsafe(`DELETE FROM audit_event WHERE id = $1::uuid`, probeId)
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;

      expect(String(error.meta?.message)).toMatch(
        /audit_event is append-only: DELETE is not permitted \(FR-034\)/,
      );
    });
  });

  it('leaves the probe row completely unmodified after every rejected attempt from either role', async () => {
    const row = await ownerClient.auditEvent.findFirstOrThrow({ where: { id: probeId } });
    expect(row.action).toBe(probeAction);
  });

  describe('TRUNCATE (Fix 6)', () => {
    it('as vertice_owner: rejects TRUNCATE on the parent table via the trigger, leaving every row intact', async () => {
      const before = await ownerClient.auditEvent.count();

      const error = await ownerClient
        .$executeRawUnsafe(`TRUNCATE audit_event`)
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;
      expect(String(error.meta?.message)).toMatch(
        /audit_event is append-only: TRUNCATE is not permitted \(FR-034\)/,
      );

      const after = await ownerClient.auditEvent.count();
      expect(after).toBe(before);
    });

    it('as vertice_owner: rejects TRUNCATE addressed directly at a partition, not only at the parent name', async () => {
      const before = await ownerClient.auditEvent.count();

      const error = await ownerClient
        .$executeRawUnsafe(`TRUNCATE audit_event_default`)
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;
      expect(String(error.meta?.message)).toMatch(
        /audit_event is append-only: TRUNCATE is not permitted \(FR-034\)/,
      );

      const after = await ownerClient.auditEvent.count();
      expect(after).toBe(before);
    });

    it('as vertice_app: rejects TRUNCATE with a privilege-denied error, never reaching the trigger (the role was never granted TRUNCATE at all)', async () => {
      const error = await appClient
        .$executeRawUnsafe(`TRUNCATE audit_event`)
        .catch((caught: unknown) => caught);

      expect(isPrismaKnownRequestError(error)).toBe(true);
      if (!isPrismaKnownRequestError(error)) throw error;
      expect(error.meta?.code).toBe('42501');
      expect(String(error.meta?.message)).not.toMatch(/append-only/i);
    });
  });
});
