-- D-7 — createdAt/updatedAt reconciliation (docs/local-environment.md).
--
-- data-model.md's "Shared conventions" preamble states every table carries
-- `createdAt`/`updatedAt`, but the per-table field lists in sections 1-4
-- mostly omitted them, and the baseline migration (T026) implemented the
-- field lists literally. The coordinator's decision: add `created_at`/
-- `updated_at` to the mutable entity tables that lack them —
-- `local_credentials`, `external_identities`, `permissions`, `roles`,
-- `organizational_units` — and explicitly NOT to join tables
-- (`role_permissions`, `user_roles`, `org_scope_grants` — their
-- `granted_at` already carries the semantic timestamp), NOT to `sessions`
-- (`created_at` + `last_activity_at` are the meaningful instants), and NOT
-- to `audit_event` (append-only; `occurred_at` is the timestamp, and a
-- mutable `updated_at` on an immutable table would be incoherent).
--
-- Additive and forward-only: every column is added NOT NULL with a
-- CURRENT_TIMESTAMP default, which both backfills any existing row (the
-- default applies to rows that already exist at ADD COLUMN time, not only
-- to future inserts) and supplies every future insert issued outside
-- Prisma. Prisma's own `@updatedAt` directive stamps a fresh value on every
-- application-level update regardless of this default; the default exists
-- as a database-level backstop so a raw SQL insert can never violate
-- NOT NULL, mirroring `users.created_at`'s existing DEFAULT CURRENT_TIMESTAMP.

-- CreateColumn: local_credentials
ALTER TABLE "local_credentials" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "local_credentials" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: external_identities
ALTER TABLE "external_identities" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "external_identities" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: permissions
ALTER TABLE "permissions" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "permissions" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: roles
ALTER TABLE "roles" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "roles" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateColumn: organizational_units
ALTER TABLE "organizational_units" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "organizational_units" ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
