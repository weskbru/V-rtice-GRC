-- docker/postgres/init/01-roles.sql
--
-- Bootstraps the two PostgreSQL roles required by ADR-005
-- (specs/001-grc-platform-foundation/research.md) for every from-scratch
-- Compose environment (docker-compose.yml and docker-compose.test.yml both
-- mount this file into /docker-entrypoint-initdb.d/, so it never needs to be
-- duplicated):
--
--   - an OWNER/MIGRATION role that owns the database and the `public` schema
--     and is the only role Prisma migrations ever connect as
--     (DATABASE_MIGRATION_URL);
--   - a restricted APPLICATION role that the running API always connects as
--     (DATABASE_URL) and that can never ALTER/DROP anything, and — critically
--     for the append-only audit guarantee — is never granted UPDATE/DELETE on
--     `audit_event` because it only ever receives the default privileges
--     granted below (SELECT, INSERT, UPDATE, DELETE on tables in general; the
--     UPDATE/DELETE revocation specific to `audit_event` is applied by the
--     Prisma migration that creates that table and its trigger, not here —
--     this script only establishes the two-role split, it does not know about
--     application tables yet).
--
-- This file runs automatically only on a brand-new PostgreSQL data directory
-- (the official postgres image skips /docker-entrypoint-initdb.d/ once the
-- data directory already contains a cluster). It is intentionally idempotent
-- anyway (safe to run again by hand against an existing database) because
-- docker-compose.test.yml reuses a tmpfs data directory that is recreated on
-- every `up`.
--
-- Passwords and role names are never hard-coded here. The official postgres
-- image invokes every *.sql init script through `psql`, and `psql` supports
-- reading process environment variables with the `\getenv` meta-command
-- (PostgreSQL 10+), so the actual values come from the container's
-- environment — which docker-compose.yml / docker-compose.test.yml populate
-- from the host environment (.env), falling back to the documented dev-only
-- defaults in .env.example. Nothing here is a literal secret.
--
-- Bootstrap connection: the official postgres image runs init scripts
-- connected as $POSTGRES_USER to $POSTGRES_DB. docker-compose.yml sets
-- POSTGRES_USER=postgres (a superuser, mirroring how the native local
-- PostgreSQL on this machine is administered), so this script always has
-- the privileges it needs to create roles and reassign ownership.

\set ON_ERROR_STOP on

\getenv target_db POSTGRES_DB
\getenv owner_role POSTGRES_OWNER_USER
\getenv owner_password POSTGRES_OWNER_PASSWORD
\getenv app_role POSTGRES_APP_USER
\getenv app_password POSTGRES_APP_PASSWORD

-- NOTE on approach: every statement below that needs a conditional or a
-- dynamic identifier/literal is built with format(...) in a plain SELECT and
-- fired with \gexec, instead of a PL/pgSQL DO $$ ... $$ block. psql performs
-- :'var'/:"var" interpolation by scanning the raw query text, but it treats
-- the body of a dollar-quoted string ($$ ... $$) as opaque, so a DO block
-- reaches the server with the literal characters ":'owner_role'" still in
-- it — a syntax error, not a substitution. Plain top-level SQL has no such
-- quoting, so interpolation works there; \gexec then executes whatever text
-- the SELECT produced as a separate, ordinary command. A WHERE clause with
-- no matching row makes \gexec execute nothing, which is how the
-- create-vs-alter branches below stay conditional without a DO block.

-- 1. Create (or update the password of) the owner/migration role.
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'owner_role', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'owner_role')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'owner_role', :'owner_password')
WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'owner_role')
\gexec

-- 2. Create (or update the password of) the restricted application role.
--    NOSUPERUSER/NOCREATEDB/NOCREATEROLE are the defaults for CREATE ROLE,
--    stated explicitly here so the restriction is visible in the script
--    rather than implied.
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'app_role', :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'app_role', :'app_password')
WHERE EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role')
\gexec

-- 3. The owner role owns the database and the `public` schema. Migrations
--    (CREATE TABLE, CREATE TRIGGER, privilege grants, extensions) run as this
--    role so the application role never needs — and is never granted — DDL
--    rights.
SELECT format('ALTER DATABASE %I OWNER TO %I', :'target_db', :'owner_role')
\gexec

ALTER SCHEMA public OWNER TO :"owner_role";

-- 4. Lock down the `public` schema: no implicit rights for anyone, then grant
--    back only what the application role needs to connect and use it.
REVOKE ALL ON SCHEMA public FROM PUBLIC;

SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'target_db', :'app_role')
UNION ALL
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app_role')
\gexec

-- 5. Default privileges: every table/sequence the owner role creates from now
--    on (i.e. every Prisma migration) automatically grants the application
--    role ordinary CRUD rights — never DDL, never ownership. This is what
--    lets `DATABASE_URL` (app role) run the API against a schema managed
--    exclusively through `DATABASE_MIGRATION_URL` (owner role).
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
  :'owner_role', :'app_role'
)
UNION ALL
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
  :'owner_role', :'app_role'
)
\gexec

-- 6. Extensions used by the schema (trigram search on the risk register,
--    case-insensitive citext columns such as email). Created by the owner
--    role so a future migration never needs elevated rights just to add one.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
