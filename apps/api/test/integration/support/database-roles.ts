/**
 * Raw, standalone `PrismaClient` connections to `pharos_grc_test`, one per
 * ADR-005 database role — used by T032 to prove the append-only guarantee
 * holds under BOTH enforcement layers, and by the harness's own reset
 * helper below.
 *
 * These are deliberately NOT `PrismaService` (the application's own
 * connection, always the restricted `pharos_app` role — see that class's
 * contract) — T032 must "connect as each role explicitly", including the
 * OWNER role, which the running application must never do. A second,
 * throwaway `PrismaClient` instance per role is the simplest way to get an
 * explicit, independent connection as a given role without smuggling a
 * second datasource into the Nest DI container.
 */
import { PrismaClient } from '@prisma/client';

import { TEST_DATABASE_MIGRATION_URL, TEST_DATABASE_URL } from './env';

/** Connects as `pharos_app` — the same restricted role the running
 * application always uses. */
export function createAppRolePrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
}

/** Connects as `pharos_owner` — the migration/owner role. Test-harness use
 * only (this file and T032); application code must never do this. */
export function createOwnerRolePrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: TEST_DATABASE_MIGRATION_URL });
}

/**
 * Tables truncated by `resetMutableTestData` — every ordinary (non-audit)
 * table, in FK-safe order (children before parents). `audit_event` is
 * deliberately absent: see that function's doc comment.
 */
const MUTABLE_TABLES_IN_FK_SAFE_ORDER = [
  // Risk Management (US2, T083/T084) — children first: causes/consequences
  // reference `risks`; `risks` references `risk_categories`/`risk_types`/
  // `risk_origins`/`organizational_units`/`users`, all truncated below.
  //
  // Risk Assessment/Methodology (US4, T120) — `risk_assessments` and
  // `risks` hold a circular FK pair (`risks.current_assessment_id` <->
  // `risk_assessments.risk_id`). This does not matter for a single
  // multi-table `TRUNCATE ... CASCADE` statement (unlike `DELETE`, listed
  // order is irrelevant — every named table's rows are removed together and
  // any FK referencing a table also in the list never blocks it), only for
  // `DELETE`-based cleanup, which this harness does not use.
  'risk_assessments',
  'risk_methodology_versions',
  'risk_methodologies',
  'risk_causes',
  'risk_consequences',
  'risks',
  'risk_categories',
  'risk_types',
  'risk_origins',
  'org_scope_grants',
  'user_roles',
  'role_permissions',
  'sessions',
  'external_identities',
  'local_credentials',
  'roles',
  'permissions',
  'users',
  'organizational_units',
] as const;

/**
 * Resets every ordinary table to empty, as the OWNER role, via `TRUNCATE`
 * — never `DELETE`. This is the harness's "targeted truncation" isolation
 * strategy (used once, in globalSetup, before the whole integration run
 * starts — never between individual tests, and never by application
 * code): individual tests are expected to use unique fixture data
 * (support/fixtures.ts, support/env.ts's `uniqueTestMarker`) rather than
 * assuming a table is empty mid-run, so this only needs to establish a
 * clean starting point once per run, not fight over ordering with
 * whichever spec files vitest schedules next to each other.
 *
 * `audit_event` is NEVER included here, on purpose:
 *
 *   1. It cannot be `DELETE`d by any role (T032 proves this — the owner
 *      role's `DELETE` is rejected by the append-only trigger just as
 *      surely as the app role's is rejected by privilege revocation).
 *   2. Assurance fix (Fix 6): `TRUNCATE` USED TO bypass the `BEFORE UPDATE
 *      OR DELETE` trigger entirely (Postgres fires that trigger only for
 *      row-level `UPDATE`/`DELETE`, never for `TRUNCATE`), so it would
 *      technically succeed as the owner role. A separate `BEFORE TRUNCATE`
 *      trigger (`20260907100100_audit_event_prevent_truncate`, reusing the
 *      SAME rejection function) now closes that gap — see
 *      `audit-append-only.spec.ts`'s own "TRUNCATE (Fix 6)" tests. Even
 *      with that gap closed, this harness still would not reach for
 *      `TRUNCATE audit_event` here: it would misrepresent what
 *      "append-only" means for a production audit trail (retention there
 *      is by partition detachment, ADR-005 — never a bulk clear), so
 *      `audit_event` must never be added to
 *      `MUTABLE_TABLES_IN_FK_SAFE_ORDER` above regardless of whether the
 *      trigger would now stop it anyway.
 *
 *      That new guard had a real, previously-invisible side effect on THIS
 *      function, discovered while verifying Fix 6: `audit_event` carries
 *      FKs to `organizational_units`/`users` (its own
 *      `organizational_unit_id`/`actor_user_id`), both of which ARE in
 *      `MUTABLE_TABLES_IN_FK_SAFE_ORDER` — so PostgreSQL's `TRUNCATE ...
 *      CASCADE` below has, in fact, ALWAYS silently swept `audit_event`
 *      (the parent AND every partition) into this same reset, despite this
 *      function's own stated intent that it never touch that table. Fix 6
 *      turned that silent, unintended sweep into a loud failure that broke
 *      this function outright. See `withAuditEventTruncateGuardDisabled`
 *      below for the fix: the guard is disabled ONLY around this ONE
 *      owner-executed, once-per-whole-run administrative statement, then
 *      re-enabled immediately after (success or failure) — exactly the "a
 *      table owner who first disables the trigger" case the migration's
 *      own comment says Fix 6 was never meant to stop. This harness IS
 *      that owner, doing so deliberately, narrowly, and visibly (never as
 *      a path `pharos_app` — which has no `ALTER TABLE` privilege at all —
 *      could ever reach).
 *   3. It is unnecessary: audit rows accumulate by design, and every
 *      integration test that asserts something about `audit_event` scopes
 *      its query by a unique marker it created (a fresh `entityId` or
 *      `correlationId`), exactly as a real caller querying audit history
 *      would — never by counting the whole table or assuming it is empty.
 */
/** `audit_event` (the parent) plus every existing partition — the exact
 * set of relations that carry their OWN copy of the
 * `audit_event_prevent_truncate` trigger (Fix 6: a statement-level
 * `TRUNCATE` trigger does NOT cascade to partitions the way a row-level
 * `UPDATE`/`DELETE` trigger does — see that migration's own header). Used
 * ONLY by `resetMutableTestData` below to toggle the guard off/on around
 * its one administrative reset; never by application code. */
async function listAuditEventTruncateTriggerTargets(
  owner: PrismaClient,
): Promise<readonly string[]> {
  const rows = await owner.$queryRawUnsafe<{ relname: string }[]>(
    `SELECT 'audit_event' AS relname
     UNION ALL
     SELECT c.relname
     FROM pg_inherits i
     JOIN pg_class c ON c.oid = i.inhrelid
     JOIN pg_class p ON p.oid = i.inhparent
     JOIN pg_namespace n ON n.oid = p.relnamespace
     WHERE p.relname = 'audit_event' AND n.nspname = 'public'`,
  );
  return rows.map((row) => row.relname);
}

async function setAuditEventTruncateGuardEnabled(
  owner: PrismaClient,
  targets: readonly string[],
  enabled: boolean,
): Promise<void> {
  for (const target of targets) {
    await owner.$executeRawUnsafe(
      `ALTER TABLE "${target}" ${enabled ? 'ENABLE' : 'DISABLE'} TRIGGER audit_event_prevent_truncate`,
    );
  }
}

export async function resetMutableTestData(): Promise<void> {
  const owner = createOwnerRolePrismaClient();
  try {
    const tableList = MUTABLE_TABLES_IN_FK_SAFE_ORDER.map((table) => `"${table}"`).join(', ');

    // Assurance fix (Fix 6) — see this file's own header ("Assurance fix
    // (Fix 6)" bullet) for why this cascade truncate reaches `audit_event`
    // at all, and why disabling its `BEFORE TRUNCATE` guard around exactly
    // this one statement (never left disabled afterward, success or
    // failure) is the correct fix rather than either accepting data loss
    // or abandoning `TRUNCATE ... CASCADE` for this reset.
    const auditEventTruncateTargets = await listAuditEventTruncateTriggerTargets(owner);
    await setAuditEventTruncateGuardEnabled(owner, auditEventTruncateTargets, false);
    try {
      await owner.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
    } finally {
      await setAuditEventTruncateGuardEnabled(owner, auditEventTruncateTargets, true);
    }
  } finally {
    await owner.$disconnect();
  }
}
