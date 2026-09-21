/**
 * T069 — "seed the initial administrator with `mustChangePassword = true`".
 *
 * ## Reconciliation, not duplication
 *
 * `platform.seed.ts` (T042, already implemented and idempotent) already
 * does exactly this: `seedPlatform` → `upsertBootstrapAdmin` →
 * `ensureLocalCredential` creates the `Platform Administrator` account's
 * `LocalCredential` with `mustChangePassword: true` (see that file's own
 * "No real secret" and "Idempotency" sections), sourced from
 * `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` and never re-touched on a later
 * run. `data-model.md §14`'s requirement ("one administrator account whose
 * password must be changed on first sign-in") is therefore already fully
 * satisfied by the existing seed — there is no second, separate
 * administrator concept T069 introduces.
 *
 * A second, independent implementation of "create the admin user" here
 * would either (a) duplicate `upsertBootstrapAdmin`'s logic against the
 * same `User.email` unique constraint — a race/ordering hazard between two
 * scripts that both claim to be the source of truth for the same row, or
 * (b) diverge from it over time as one file is edited and the other is
 * not. Both are worse than the seed staying in one place.
 *
 * **Decision**: this file is a documented alias, not a second
 * implementation — `prisma/seed/index.ts` (the actual `prisma db seed`
 * entry point) continues to call `seedPlatform` directly and is
 * UNCHANGED. This file exists so `admin.seed.ts` is a real, greppable
 * artifact of the T069 task (per this task's requirement to decide whether
 * it is "a separate file or a documented part of the existing seed, and
 * justify it") that points a future reader straight at the actual
 * implementation and the specific reasoning above, rather than a second
 * seed script silently never being invoked by anything.
 */
export { seedPlatform, type PlatformSeedResult } from './platform.seed';
