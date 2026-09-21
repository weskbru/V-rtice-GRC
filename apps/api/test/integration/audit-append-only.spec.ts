/**
 * T032 — proves `audit_event` is append-only at the DATABASE level
 * (FR-034, ADR-005, data-model.md §5), independent of any application
 * code: even a direct SQL `UPDATE`/`DELETE` must fail, under BOTH
 * enforcement layers the append-only migration installs
 * (20260905120200_audit_event_append_only/migration.sql):
 *
 *   1. Privilege revocation — the restricted `pharos_app` role (the only
 *      role the running application ever connects as) has no `UPDATE`/
 *      `DELETE` grant on `audit_event` at all.
 *   2. A `BEFORE UPDATE OR DELETE` trigger — rejects the operation for
 *      EVERY role, including `pharos_owner` (the table owner), so even a
 *      privileged operator running an ad hoc `UPDATE` by mistake fails
 *      loudly instead of silently succeeding because a grant happened to
 *      be missing.
 *
 * This file connects as each role explicitly via
 * `support/database-roles.ts` (never through `PrismaService`, which is
 * hard-wired to the `pharos_app` role and would only be able to exercise
 * layer 1).
 *
 * ## Why a real row must exist before any of this is meaningful
 *
 * The trigger is declared `FOR EACH ROW`. An `UPDATE`/`DELETE` whose
 * `WHERE` clause matches zero rows never fires a row-level trigger at all
 * — confirmed empirically against this instance (`UPDATE audit_event SET
 * ... WHERE false` returns "UPDATE 0" even as `pharos_owner`, with no
 * exception). So this suite inserts one real probe row first (as the app
 * role, via its genuine `INSERT` grant) and targets every assertion at
 * that row's `id`.
 */
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
    // Deliberately NO cleanup delete/update of the probe row: by the time
    // this suite finishes it has proven, twice over, that no role can
    // remove it via DML. Leaving it in place is the honest reflection of
    // that; see support/database-roles.ts for how (and when — never here)
    // this harness resets state instead (TRUNCATE, owner-only, once per
    // whole run, in globalSetup).
    await appClient.$disconnect();
    await ownerClient.$disconnect();
  });

  describe('as pharos_app — the restricted role the running application always uses', () => {
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

      // SQLSTATE 42501 = insufficient_privilege — the same code Postgres
      // uses for a bare privilege denial. The message text is locale-
      // dependent (this instance reports Portuguese: "permissão negada
      // para tabela audit_event"), so the assertion pins the
      // locale-independent SQLSTATE and confirms the message is a plain
      // privilege denial, NOT the application-defined trigger message
      // below — proving pharos_app never even reaches the trigger.
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

  describe('as pharos_owner — the migration/owner role; the trigger backstop', () => {
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

      // Owning the table (and therefore having UPDATE/DELETE privilege) is
      // NOT enough — this is the exact, application-defined message the
      // trigger function raises (audit_event_prevent_modification(),
      // migration 20260905120200), not a generic Postgres message, so
      // matching it verbatim is locale-independent and specifically
      // distinguishes "trigger rejected this" from "privilege denied".
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

  // -------------------------------------------------------------------
  // Assurance fix (Fix 6, confirmed gap) — `BEFORE TRUNCATE` coverage.
  // `UPDATE`/`DELETE` and `TRUNCATE` are DISTINCT trigger events in
  // PostgreSQL; the `BEFORE UPDATE OR DELETE` trigger above never fired
  // for `TRUNCATE audit_event`, which removed every row in one statement.
  // -------------------------------------------------------------------

  describe('TRUNCATE (Fix 6)', () => {
    it('as pharos_owner: rejects TRUNCATE on the parent table via the trigger, leaving every row intact', async () => {
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

    // The defect this closes: a `BEFORE TRUNCATE` trigger declared ONLY on
    // the partitioned PARENT does not automatically cover a partition
    // addressed DIRECTLY by its own name — confirmed empirically (see the
    // migration's own header, `20260907100100_audit_event_prevent
    // _truncate`) — so the fix explicitly adds the SAME trigger to every
    // partition. This proves that holds for the always-present DEFAULT
    // partition, without depending on which monthly partition exists at
    // whatever date this suite happens to run.
    it('as pharos_owner: rejects TRUNCATE addressed directly at a partition, not only at the parent name', async () => {
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

    it('as pharos_app: rejects TRUNCATE with a privilege-denied error, never reaching the trigger (the role was never granted TRUNCATE at all)', async () => {
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
