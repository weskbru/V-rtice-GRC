# Local Development Environment — PharosGRC

> **Role of this file, 2026-09-14.** This is a dated decision log (D-1..D-23) and a record of
> environment traps already paid for on the reference development machine — it is **not** the
> setup guide. For first-time environment setup and day-to-day development commands, see
> [`docs/guides/development.md`](./guides/development.md). For the full test strategy and CI mapping, see
> [`docs/guides/testing.md`](./guides/testing.md). For known symptoms and their root causes, see
> [`docs/guides/troubleshooting.md`](./guides/troubleshooting.md). Read this file for *why* a decision was made
> and what already went wrong once; read `docs/guides/development.md` for *what to run*.

This file records the **actual** environment this project is being developed on, and the coordinator
decisions taken because of it. Every agent working on this repository must read it before running
commands. It is descriptive of the development machine; it does not replace `plan.md`, which remains
the architectural authority.

## Machine facts

| Fact | Value |
|------|-------|
| OS | Windows 11 |
| Shells | PowerShell 5.1 and Git Bash |
| Node | v24.20.0 |
| npm | 11.19.0 |
| pnpm | 10.34.5 — installed at `C:\Users\rsilv\AppData\Roaming\npm`, **not on the default PATH** |
| Docker | Docker Desktop 29.7.2, `linux/amd64` engine via the `desktop-linux` context (WSL2) |
| PostgreSQL | 18.6, running **natively** on `localhost:5432` |
| Redis | **Not available** |
| psql | `C:\Program Files\PostgreSQL\18\bin\psql.exe` |

### Putting pnpm on PATH

```bash
# Git Bash
export PATH="/c/Users/rsilv/AppData/Roaming/npm:$PATH"
```

```powershell
# PowerShell
$env:Path = "C:\Users\rsilv\AppData\Roaming\npm;" + $env:Path
```

### Web dev server runs on Turbopack

Since `specs/013-stabilization-audit` §4.6, the `dev` script of `apps/web` is `next dev --turbopack`
(Fast Refresh measured at ~0.6 s against 0.85–1.7 s on webpack; `auth.spec.ts` 8.3 s against 20.7 s).
`next build` stays on webpack, and CI never runs `next dev` (every E2E job starts `next start`). To
compare against the old bundler, run `pnpm --filter @pharos/web exec next dev`. As before, `apps/web`
has no `.env` of its own: export `API_INTERNAL_URL` and `APP_ORIGIN` before starting it.

## Database provisioning (already done)

Provisioned directly against the native PostgreSQL instance, mirroring what
`docker/postgres/init/01-roles.sql` does for the Compose stack.

| Object | Value |
|--------|-------|
| Development database | `pharos_grc` |
| Test database | `pharos_grc_test` |
| Owner / migration role (`DATABASE_MIGRATION_URL`) | `pharos_owner` / `pharos_owner_dev` |
| Restricted application role (`DATABASE_URL`) | `pharos_app` / `pharos_app_dev` |
| Extensions in both databases | `pg_trgm`, `citext` |

Both databases have `public` owned by `pharos_owner`, `PUBLIC` privileges revoked, and default
privileges set so that tables created by `pharos_owner` grant `SELECT, INSERT, UPDATE, DELETE` to
`pharos_app`. **ADR-005 depends on this two-role split**: the application must never connect with the
owner role, or the append-only guarantee on `audit_event` is only a convention.

The passwords above are development-only values for a local instance. They are documented here and in
`.env.example` deliberately; they are not production secrets and must never be reused as such.

## Coordinator decisions forced by the environment

### D-1 — Development runs against the native PostgreSQL, not Compose

> **2026-09-14 note (documentation pass, read-only verification against `docs/deferred-findings.md`
> and `specs/001-grc-platform-foundation/quickstart.md`'s own addendum, not re-executed here):** the
> entry below still describes F-12 and F-13 as open. Both were measured **resolved**
> 2026-09-11 (`docs/deferred-findings.md` F-12/F-13, `quickstart.md` §2 addendum): the packaged
> `api` image no longer crash-loops, and `docker-compose.yml`'s `SESSION_COOKIE_SECURE=true`
> override on the `api` service means the boot-validation half of F-13 was "never true as stated."
> F-13's browser-refusal half is narrowed, not cleared: measured **false for Chromium**
> specifically (a real Chromium session stores/sends/clears the `Secure` cookie over
> `http://localhost`); Firefox/Safari and any non-`localhost` origin remain unverified. The
> narrative below is left as-is per this file's own convention (append, don't rewrite) — treat the
> paragraphs that follow as the historical record of the original finding, and the two findings
> themselves as the current source of truth.

**Historical reasoning (still why the ports are what they are)**: `docker-compose.yml` and
`docker-compose.test.yml` were originally authored in full without ever being executable on this
machine, because Docker was not installed. Their host port bindings were parameterised from the start
— postgres defaults to `5433` (test: `5434`), redis defaults to `6379` (test: `6380`) — specifically so
they would never collide with the native instance on `5432` once Docker became available. That
reasoning still governs the defaults today.

**Update — 2026-09-05, Docker Desktop installed**: Docker is now available (Docker Desktop 29.7.2,
`linux/amd64` engine via the `desktop-linux`/WSL2 context, zero containers before this work). Both
compose files were run for the first time and, as expected for previously-unexecuted infrastructure,
were broken. Found and fixed (all within `docker/`, `docker-compose*.yml`):

- `docker/api.Dockerfile`: `pnpm --filter ./apps/api deploy --prod` failed outright with
  `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE` — pnpm v10 requires `inject-workspace-packages=true` in
  `.npmrc` for the default deploy algorithm, which this workspace does not set. Fixed by adding
  `--legacy` to the `pnpm deploy` invocation (the pre-v10 algorithm, which needs no workspace-wide
  `.npmrc` change).
- `docker/api.Dockerfile`: the runtime `CMD` ran `node dist/main.js`, but `apps/api/tsconfig.json` sets
  `rootDir: "./"` (not `./src`), so `nest build` actually emits to `dist/src/main.js`. The container
  crash-looped with `MODULE_NOT_FOUND` on every start. Fixed by pointing `CMD` at `dist/src/main.js`.
- `docker-compose.test.yml` had no explicit `name:`, so Compose defaulted its project name to the
  current directory (`pharos-grc`) — identical to `docker-compose.yml`'s default, with the same service
  names (`postgres`, `redis`). Running `docker compose -f docker-compose.test.yml up` while the dev
  stack was up **recreated and replaced** the dev containers instead of running alongside them, directly
  contradicting this file's own header comment. Fixed by adding `name: pharos-grc-test`; both stacks
  now run genuinely concurrently on their documented, non-colliding ports.
- `docker/postgres/init/01-roles.sql` worked as written against both compose files: the two ADR-005
  roles are created with `NOSUPERUSER NOCREATEDB NOCREATEROLE`, `public` and the database are owned by
  `pharos_owner`, and `pg_trgm`/`citext` are installed — verified directly against the running
  container, not just by reading the script.
- `docker-compose.yml`'s `postgres`/`redis` services and `docker-compose.test.yml` in full were brought
  up, confirmed healthy, and torn down cleanly (`down -v`); the native `pharos_grc`/`pharos_grc_test`
  databases were checked before and after and are untouched.
- **F-6, now resolved**: `apps/web/next.config.ts` sets `output: "standalone"` — required by
  `docker/web.Dockerfile`'s runtime stage, which copies only `.next/standalone` and `.next/static`.
  Gated behind a `DOCKER_BUILD=1` build-time flag rather than always on: turning it on unconditionally
  was verified to break `pnpm --filter @pharos/web run build` outright on this native Windows machine —
  `EPERM: operation not permitted, symlink ...` — because standalone tracing recreates pnpm's symlinked
  `node_modules` tree, which needs `SeCreateSymbolicLinkPrivilege` (Windows Developer Mode or an
  elevated shell), neither available here. `docker/web.Dockerfile` sets `DOCKER_BUILD=1` before running
  the same `build` script, since its Linux container has no such restriction; local `next build`,
  `next dev` and Playwright's `webServer` (`pnpm dev`) are unaffected either way — all reverified after
  the change (121/121 unit tests still pass, `next dev` still serves `/login` with 200).
  `apps/web/public/` was confirmed to not exist and nothing in `apps/web/src` references any static
  asset (no favicon, no image); the Dockerfile's `COPY` of it was removed rather than fabricating an
  empty directory to satisfy it.
- The `postgres:17-alpine` image was confirmed to carry the `pt-BR-x-icu` ICU collation used by the risk
  register's `owner.full_name` sort — see the verification note below.

**Consequence, and what "verified end-to-end" actually required**: both images now build
(`docker compose build`) and `docker compose up` reaches four running containers. Getting from there to
a real authenticated request required two more fixes, both within this pass's `docker-compose.yml` /
`docker/web.Dockerfile` surface, discovered only because the images finally ran together:

- Next.js resolves `next.config.ts`'s `rewrites()` (the ADR-014 `/api/*` proxy target) once, at
  `next build` time, and never re-reads it when `server.js` starts — so `docker-compose.yml`'s runtime
  `environment: API_INTERNAL_URL: http://api:3001` for the `web` service had **no effect** on that proxy.
  Worse, the value actually baked in came from `apps/web/.env` (a developer's own local-dev file,
  `API_INTERNAL_URL=http://localhost:3001`), which `COPY . .` brings into the build context despite
  `.dockerignore` supposedly excluding it (see F-14 in `docs/deferred-findings.md` — that exclusion does
  not work for nested paths). Fixed by passing `API_INTERNAL_URL`/`APP_ORIGIN` as explicit Docker build
  `args` in `docker-compose.yml`, which `docker/web.Dockerfile` turns into `ENV` before `next build` —
  Next.js's env loading never overrides a variable already set in `process.env`, so this wins regardless
  of what a stray `.env` file also contributes. Confirmed by curling the rewrite before (`ECONNREFUSED`
  in the web container's logs, dialing `localhost:3001` from inside its own network namespace) and after
  (`200 OK`) the fix.
- The packaged `api` runtime image crash-loops (`Cannot find module '.prisma/client/default'`) — a
  distinct, genuine defect in `docker/api.Dockerfile`'s `pnpm deploy --legacy` step, outside this pass's
  surface. Recorded as **F-12** rather than fixed here. To still verify the web-side fixes and the
  database end to end, this pass ran the Dockerfile's own intermediate `build` stage (which still has
  the Prisma-generated client and full devDependencies) as a throwaway container, network-aliased `api`
  on the compose network, in place of the broken packaged image. That is a verification workaround, not
  a shipped fix — `docker compose up` alone does not yet produce a working `api` container. See F-12 and
  **F-13** (a second, independent reason the packaged `api` container as configured refuses to boot:
  `NODE_ENV=production` plus `.env.example`'s `SESSION_COOKIE_SECURE=false` default fails the API's own
  production validation) in `docs/deferred-findings.md`.

With that workaround in place, the full loop was proven with real command output, not just healthy
containers: `prisma migrate deploy` (13 migrations) and `prisma db seed` ran successfully against the
containerized PostgreSQL; a `curl` login through the **web** container's own `/api/*` rewrite
(`POST http://localhost:3100/api/v1/auth/login`, i.e. the same path a real browser's fetch would take)
returned a real session cookie and the seeded administrator's real user/permissions/scope; the
containerized web app's server-rendered `/dashboard` page, fetched with that session cookie, contained
the real signed-in user's name; `GET /api/v1/risks` returned the real (empty, freshly-seeded) risk
register, not a mock. Every container, volume, network and image created for this was torn down
afterward (`docker compose down -v`, `docker rmi`), and the native `pharos_grc`/`pharos_grc_test`
databases on port 5432 were confirmed untouched before and after.

**The real bring-up sequence, verified** (host ports remapped to `3101`/`3100` in these examples only
because native dev processes already held `3001`/nothing on this run — the defaults in
`docker-compose.yml` are `3001`/`3000` and need no remapping on a clean machine):

```bash
cp .env.example .env
# set SEED_ADMIN_PASSWORD in .env (or the current shell) — .env.example ships it blank on purpose
docker compose up -d --build          # builds api + web, starts all four services
# The packaged `api` container crash-loops here today (F-12) — `docker compose exec api ...`
# cannot reach it, since a crash-looping container is never in a running state long enough for
# `exec` to attach. Everything below this line was verified against a stand-in `api` process (this
# pass's build-stage workaround, run from the monorepo root, not the deployed image's own `/app`),
# not against `docker compose exec api` itself:
pnpm --filter ./apps/api exec prisma migrate deploy   # from the monorepo root, DATABASE_MIGRATION_URL
                                                       # pointed at the compose postgres (5433)
pnpm --filter ./apps/api exec prisma db seed          # same connection, SEED_ADMIN_* set
```

**Disagreement with `specs/001-grc-platform-foundation/quickstart.md`**: quickstart.md's full-stack
alternative is `docker compose exec api pnpm exec prisma migrate deploy` /
`... pnpm exec prisma db seed` (no `--filter`, run inside the container via `docker compose exec`).
This pass could **not** validate that exact command against the real packaged image — F-12 means the
`api` container never stays in a running state for `docker compose exec` to attach to. Whether
quickstart's plain `pnpm exec` (no `--filter`) is the right form for the deployed image's layout
(`/app` *is* the deployed `apps/api` package, not a monorepo root with an `./apps/api` to filter to) or
needs adjustment is therefore an open question, not a confirmed defect — re-verify once F-12 is fixed,
using `docker compose exec api pnpm exec prisma migrate deploy` literally, before trusting either form.

**`pt-BR-x-icu` collation — confirmed present**: queried directly against a running
`postgres:17-alpine` container: `SELECT collname, collprovider FROM pg_collation WHERE collname ILIKE
'%pt-BR%'` returns `pt-BR-x-icu | i` (ICU-provided), and `SELECT 'à' COLLATE "pt-BR-x-icu" < 'b' COLLATE
"pt-BR-x-icu"` returns `t`. The image's PostgreSQL 17.11 build links ICU with full CLDR locale data, so
every ICU locale collation — including `pt-BR-x-icu` — is available without any extra installation
step.

**WebKit/Linux-container route (F-4)**: Docker Desktop's engine here runs `linux/amd64` containers via
the `desktop-linux` (WSL2) context, so a Linux-container route for Playwright's WebKit project is
genuinely available on this machine (e.g. an official `mcr.microsoft.com/playwright` image running the
suite against the containerized stack) — this was not evaluated further since fixing F-4 is out of this
pass's scope, but the option exists for T203/T207 to weigh.

### D-2 — Cache port with an in-memory fallback adapter (extends ADR-002/003/004)

Redis cannot be run here, and ADR-002 already establishes that PostgreSQL is authoritative for
sessions while Redis is only a validation cache — the same holds for the permission cache (ADR-003)
and the organizational scope cache (ADR-004).

**Decision**: the application depends on a `CacheProvider` port, not on `ioredis` directly. Two
adapters implement it:

- `RedisCacheProvider` (ioredis) — selected when `REDIS_URL` is set.
- `InMemoryCacheProvider` — selected when `REDIS_URL` is empty; process-local, TTL-aware, bounded.

`REDIS_URL` is optional in development and **required in production** (enforced by the environment
schema in `apps/api/src/infrastructure/config/env.schema.ts`, which must reject an empty `REDIS_URL`
when `NODE_ENV=production`).

Consequences accepted:

- No architectural rule is weakened, because nothing authoritative was ever stored in the cache.
- A multi-instance deployment must set `REDIS_URL`; with the in-memory adapter, invalidation of a
  permission or scope cache reaches only the local process. This is why production rejects it.
- Cache invalidation semantics (`permissionsVersion` keys, scope keys, session validation cache) are
  identical across both adapters and are covered by the same tests.

### D-3 — Node 24 instead of the plan's Node 22 LTS

Node 24 is the installed runtime and is itself an LTS line. `engines.node` is set to `>=22` so both
are acceptable; CI pins the version explicitly.

### D-4 — Integration and contract tests run against `pharos_grc_test` on port 5432

`docker-compose.test.yml` is authored for CI and for machines with Docker. Locally, the test suites
point at `TEST_DATABASE_URL` / `TEST_DATABASE_MIGRATION_URL`, which target `pharos_grc_test` on the
native instance. The test database is migrated and truncated by the suite setup, never by hand.

### D-5 — Canonical environment variable names

`.env.example`, `docker-compose.yml`, `docker-compose.test.yml`, `docker/postgres/init/01-roles.sql`
and `.github/workflows/ci.yml` were briefly written with a different set of variable names than
`specs/001-grc-platform-foundation/quickstart.md`. That mismatch is resolved: **quickstart.md is the
authoritative naming source** for every environment variable in this project. Where the two disagreed
(`APP_ORIGIN`, `API_INTERNAL_URL`, `SESSION_ABSOLUTE_LIFETIME_HOURS`, `AUTH_RATE_LIMIT_*`,
`THROTTLE_TTL_SECONDS`/`THROTTLE_LIMIT`, `ATTACHMENT_*`, `SEED_ADMIN_PASSWORD`), quickstart.md's names
won and every other file was updated to match.

The session-signing-secret variable that briefly existed in `.env.example` was removed outright rather
than reconciled. ADR-002 specifies an opaque, randomly generated session token of which only a
SHA-256 hash is stored server-side — nothing about the session is signed, so a signing secret governed
nothing and was pure surface area.

The database is `pharos_grc` (development) and `pharos_grc_test` (tests), per the Database provisioning
section above — not the plain `pharos` that an earlier draft of quickstart.md used before this
reconciliation.

### D-6 — Splitting `AUTH_RATE_LIMIT_ATTEMPTS` into per-account and per-origin limits

`.env.example` and `quickstart.md` originally defined a single `AUTH_RATE_LIMIT_ATTEMPTS`, described as
covering "per account and per origin" throttling with one shared value. That is wrong: FR-008 requires
both dimensions to be enforced, but a single low threshold (5) applied to a shared corporate NAT/VPN
egress would lock out an entire office after a handful of unrelated individual mistyped passwords —
the per-origin limit needs a materially higher ceiling than the per-account limit to be usable in a
real enterprise network.

**Decision**: split into two independently configured variables, implemented in
`apps/api/src/infrastructure/config/env.schema.ts`:

- `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` (default `5`) — failed sign-ins allowed for a single account
  before it is locked out for `AUTH_LOCKOUT_MINUTES`.
- `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` (default `20`) — failed sign-ins allowed from a single origin
  across all accounts, within `AUTH_RATE_LIMIT_WINDOW_SECONDS`, before that origin is throttled.

`AUTH_RATE_LIMIT_WINDOW_SECONDS` and `AUTH_LOCKOUT_MINUTES` are unchanged and apply to both dimensions.
`.env.example` and the environment table in `specs/001-grc-platform-foundation/quickstart.md` were
updated to match; this is the authoritative record of the split for anyone implementing the
authentication throttling logic in a later task.

### D-7 — createdAt/updatedAt reconciliation

`data-model.md`'s "Shared conventions" preamble states every table carries `createdAt`/`updatedAt`
(`timestamptz`, UTC). The per-table field lists in sections 1-4 mostly omitted them, and the baseline
migration (T026) implemented those field lists literally, flagging the tension in `schema.prisma`'s
header comment rather than silently resolving it.

**Decision**: the blanket "shared conventions" rule wins for **mutable entity** tables — a row that is
genuinely updated in place needs a queryable "when was this last changed" independent of the audit trail
(the audit trail records *what* changed; `updatedAt` records *that something did, and when*, cheaply, for
sorting/filtering without joining `audit_event`). `createdAt`/`updatedAt` were therefore added to:
`LocalCredential`, `ExternalIdentity`, `Permission`, `Role`, `OrganizationalUnit`.

**Explicitly not added**, because each of these tables already carries the timestamp that matters and a
generic pair would be redundant or incoherent:

- `RolePermission`, `UserRole`, `OrgScopeGrant` — join/grant tables whose `grantedAt` already is the
  semantic instant; they are never updated in place (a grant is revoked by deleting the row or, for
  `OrgScopeGrant`, is immutable once granted), so `updatedAt` would never change and `createdAt` would
  duplicate `grantedAt`.
- `Session` — `createdAt` (already present) and `lastActivityAt` are the meaningful instants; a session
  is never "updated" in the generic sense, only created, touched, and revoked/expired.
- `audit_event` — append-only by design (ADR-005); `occurredAt` is its timestamp, and a mutable
  `updatedAt` on a table the database itself refuses to `UPDATE` would be a standing contradiction.

**Delivery**: one additive, forward-only migration
(`20260905130000_createdat_updatedat_reconciliation`) adds each column `NOT NULL DEFAULT
CURRENT_TIMESTAMP` — the default both backfills any existing row at `ADD COLUMN` time and covers any
future insert issued outside Prisma, matching the pattern already used for `users.created_at`. Applied
with `prisma migrate deploy` (never `migrate dev`, per this file's standing rule) to both `pharos_grc`
and `pharos_grc_test`.

### D-8 — Interface Language (pt-BR)

The v1 user-facing interface is permanently in Brazilian Portuguese (pt-BR). This was already
implemented and verified before this record was written: login, dashboard, profile, shell, sidebar,
validation messages and problem+json error bodies are all in pt-BR, centralized in
`apps/web/src/lib/messages/` and `apps/api/src/shared/messages/user-messages.ts` (122 tests
passing).

**Decision**: every new user-facing string must be authored in pt-BR in these centralized catalogs,
never inline in a component. English user-facing text must not be reintroduced. This rule is now
recorded in the constitution (Principle X), `CLAUDE.md` and `AGENTS.md`, and binds every future
task and subagent without needing to be repeated per instruction.

**Why**: PharosGRC's professional users are Brazilian GRC practitioners; a mixed-language interface
is inconsistent, unprofessional for an enterprise product, and directly costs Constitution X (UX
Consistency) — terminology and interaction patterns must be consistent across the product.

Consequences accepted:

- Professional GRC terminology is translated (Risco, Risco inerente, Risco residual, Probabilidade,
  Impacto, Nível de risco, Tratamento, Controle, Avaliação, Aprovação, Trilha de auditoria, Unidade
  organizacional, Plano de ação). "Dashboard" and "Compliance" are kept as-is — they are
  established terms in Brazilian corporate vocabulary, and `CLAUDE.md` itself already uses them
  untranslated in Portuguese prose.
- Everything that is a technical identifier rather than UI stays in English: variable names,
  TypeScript types, file names, database identifiers (tables, columns, enum values, seeded role
  names), API identifiers (routes, DTO fields, RFC 9457 `type` URIs), audit action names (e.g.
  `auth.login_failed`), operational log messages, code comments and test names. Translating these
  would create drift between code, database and documentation, which Constitution I (GRC Domain
  Integrity) prohibits ("one business concept, one name").
- A future contributor or subagent adding a new screen, form or error message must add the string
  to the centralized catalog in pt-BR rather than hard-coding it inline or in English.

### D-9 — The design system has no test runner of its own, by decision

`packages/design-system` has no Vitest/Testing Library setup, no config and no `test` script. Its
components are mount-tested from `apps/web/src/components/design-system.test.tsx`, through the
package barrel (`@pharos/design-system/components`), by `apps/web`'s own Vitest + Testing Library
setup.

**Decision**: this stays as it is. New design-system components are covered by tests added to
`apps/web/src/components/design-system.test.tsx`, not by a second test runner inside the package.

**Why**: the approved task list contains no task to build test infrastructure for this package, and
adding one would be unapproved infrastructure work. The package has exactly one consumer, and that
consumer already mounts the components in a real DOM — which is the environment the components must
actually work in. A second runner would duplicate configuration, duplicate CI time and create two
places to look for a component's tests, for no coverage that the current arrangement cannot reach.

Consequence accepted: the package cannot be validated in isolation from `apps/web`. That is a real
limitation, and it becomes worth revisiting if a second consumer ever appears — at which point the
package's independence stops being theoretical. Until then it is a cost with no benefit.

### D-10 — User-facing strings in the design system arrive by prop, never hardcoded

`DataTable` already takes every user-visible string through a `DataTableLabels` prop. `RiskLevelBadge`
was written earlier and hardcodes pt-BR strings instead (`"Baixo"`/`"Médio"`/`"Alto"`/`"Crítico"`, the
`Inerente`/`Residual` basis prefix, the `"Nível de risco: …"` aria-label).

**Decision**: the labels-prop pattern is the single convention for this package. `RiskLevelBadge` is
brought onto it; `RiskMatrix` and `RiskScore` were built on it from the start.

**Why**: the defect is not that pt-BR is wrong — D-8 makes pt-BR permanent for the v1 interface — it is
that one package now holds two contradictory answers to the same question. A contributor adding the
next component has no way to know which to follow, and CLAUDE.md §2 ("baixo acoplamento") and §13.8
("evitar duplicação desnecessária") both point the same way. The direction is settled by the component
that is larger and more central, not by which was written first.

The pt-BR strings themselves live in `apps/web/src/lib/messages/` — `riskLevelLabels` in
`risks.ts` already exists — so a call site supplies one prop and the catalog stays the single source
of user-facing text (D-8).

### D-11 — Every endpoint carries a contract test, whether or not a task sheet asks for one

**Measured on 2026-09-05**: 10 of the 21 implemented API operations had **no test of any kind** — not a
contract test, not an integration test, nothing had ever called them. Two real defects lived in that
blind spot undetected while the suite reported green: `GET /risk-methodology` returned **403 to every
caller** and had never worked for anyone, and both methodology GETs returned the wrong response
envelope. They surfaced only when a developer tried to build a screen against the real API.

**Root cause**: `tasks.md` specifies tests per user-story *feature*. An endpoint that exists to support
a feature rather than being one — the reference-data reads (`/risk-categories`, `/risk-types`,
`/risk-origins`, `/org-units`, `/users`) added during the US2 integration pass, the methodology reads
added in US4 — gets no test task, and therefore got no test. The gap is systematic, not accidental, and
it will recur in every phase unless the rule is decoupled from the task sheet.

**Rule**: any task that adds or changes an HTTP endpoint MUST also add a contract test asserting, at
minimum:

1. the **authorization rule the contract states in prose** for that endpoint — including that a caller
   *without* the stated permission is refused, and that an endpoint documented as "authenticated
   session; no additional permission" genuinely succeeds for a **zero-permission** authenticated user
   (this exact assertion is the one whose absence let a 403-for-everyone endpoint ship);
2. an **unauthenticated** caller receives 401;
3. the **success response matches the contract's declared shape** — for a paginated endpoint, assert
   the `{data, meta}` envelope explicitly, with real pagination values.

This holds even when the task sheet lists no test task for that endpoint. A task sheet that omits it is
incomplete, not permissive.

**Corollary on evidence**: a passing suite is evidence only about what the suite calls. "Contract tests
green" says nothing about an endpoint no test has ever invoked — the coordinator must check coverage of
the specific surface under review, not the aggregate count. The reviewer's question is "what would have
failed if this were broken", not "how many tests passed".

### D-12 — The risk audit endpoint lives in `modules/risk`, not `core/audit`

Task T168 names `apps/api/src/core/audit/presentation/audit.controller.ts`. It was implemented at
`apps/api/src/modules/risk/presentation/audit.controller.ts` instead, and that is correct.

**Why**: `GET /risks/{riskId}/audit-events` must return **404** for a risk outside the caller's
organizational scope and **403** for a caller lacking `audit:view` on a risk they can see. Telling those
two apart requires the risk's *current* organizational unit, i.e. `RiskRepositoryPort.findById`. A
controller in `core/audit` cannot reach that: ADR-011 forbids `core/**` from importing `modules/**`, and
`eslint-plugin-boundaries` enforces it — the build fails, it is not a convention.

The alternative considered and rejected was deriving visibility from `audit_event` rows alone. That is
wrong, not merely awkward: a risk that has been reassigned carries older audit rows stamped with its
**previous** organizational unit, so scope would be answered from stale data and could disclose or hide
the wrong records.

What genuinely belongs to the platform does live in `core/audit` and is exported from `AuditModule`:
`AuditQueryService` and `AuditEventReaderPort` — permission- and scope-filtered querying of
`audit_event` by entity reference. A second business module adds its own thin controller over that same
service, exactly as Risk Management does.

**The general rule this establishes**: where a task sheet's file path contradicts ADR-011, the ADR wins.
The decision order is Constitution > specification > plan and ADRs > data model > API contracts > task
dependencies — a task sheet naming a path is the weakest of those, and a path that breaks a module
boundary is a mistake in the sheet, not permission to break the boundary.

### D-13 — An administrator may grant permissions they do not themselves hold

`RoleAdminService` (creating a role, changing a role's permissions, replacing a user's roles) and
`ScopeGrantService` (issuing `UNIT` or `GLOBAL` scope) do **not** check whether the acting administrator
already holds the permission or scope being granted. `contracts/admin.openapi.yaml` gates these purely
by `role:administer` / `user:administer` and says nothing about self-ownership. The implementing agent
flagged the silence and implemented the contract rather than inventing a restriction, which was right.

**Decision**: the contract's model stands. `role:administer` **is** the privilege boundary.

**Why a "you may only grant what you hold" rule would be security theatre here**: whoever holds
`role:administer` can edit *any* role's permission set, including the one that grants them their own
permissions. Faced with such a restriction they would add the permission to their own role first, then
grant it — two steps instead of one, with no additional control gained. Making the restriction real
would require forbidding self-role-editing, forbidding edits to any role the actor holds, and probably a
second-approver flow for permission changes — a materially different and much larger security model than
the one specified and approved.

**What actually controls this risk**, and what must therefore be protected:

- `role:administer` and `user:administer` are seeded only on `Platform Administrator`. Granting them
  broadly is the real escalation path, and that is an operational decision, not a code one.
- Every grant, revocation and scope change is audited (CLAUDE.md §8) inside the caller's transaction, on
  an append-only trail. Detection, not prevention, is the control the approved architecture relies on
  for this class of action.

**If this is ever revisited** — and for a regulated deployment it may deserve to be — it is a change to
the approved security model, not a bug fix: it belongs in the specification and the contract first, with
`docs/history/security-review.md` (T208) the natural place to raise it.

### D-14 — `packages/api-types` is generated from the hand-authored contracts, not from the reflected document

F-3 recorded the problem: `apps/api/openapi.json` is produced by reflecting NestJS decorators, and no
DTO in this codebase carries `@ApiProperty`, so all of its component schemas are
`{"type":"object","properties":{}}` — 17 routes described, not one field. T205 promises the frontend
real types, and `apps/web/src/lib/api-client.ts` and `lib/permissions.ts` both carry comments saying the
types arrive "once T205 lands". Regenerating from that document would produce a package that builds and
provides nothing.

**Decision**, taken rather than deferred:

- `packages/api-types` generates from `specs/001-grc-platform-foundation/contracts/*.openapi.yaml` —
  the hand-authored contracts, which are complete at field level and which this project already treats
  as authoritative (D-5: where the two disagree, the hand-authored spec wins).
- `apps/api/openapi.json` and `openapi:check` stay exactly as they are, and are described honestly for
  what they are: a **route-level** drift detector. They catch an added, removed or renamed route. They
  cannot see a renamed or retyped DTO field, and must not be relied on as if they could.

**Why not the alternative.** Annotating every DTO with `@ApiProperty` would make the reflected document
authoritative, at the cost of declaring each field's shape twice — once for `class-validator`, once for
Swagger — in the same file, forever, with nothing keeping the two honest. That is a standing invitation
to the exact drift the contract exists to prevent, paid for in every future DTO.

**Consequence accepted**: the generated types describe the contract, not the implementation. A
controller that diverges from its contract produces types that lie. What catches that is the contract
test suite (D-11), which exercises the real HTTP surface against the same contracts — and which is why
D-11 requires response-shape assertions, not just status codes.

### D-15 — Six shadcn/ui primitives are now deliberately modified, and must not be regenerated blind

`plan.md` describes `apps/web/src/components/ui/` as "shadcn/ui generated primitives (unmodified)", and
`.prettierignore` excludes the directory so it stays byte-identical to the CLI's output. That is no
longer true of six files, and the reason is WCAG 2.1 AA compliance (T203, T085, 015 T001/T003), not
convenience:

- **`dialog.tsx`** — captures and restores focus on close. `@radix-ui/react-dialog` hard-codes
  `onCloseAutoFocus` to focus `context.triggerRef`, discarding its own generic fallback. Every dialog in
  this application opens from a plain `<Button>`, never `<Dialog.Trigger>`, so nothing was registered and
  focus fell to `<body>` on every close — a **serious** violation of SC 2.4.3, reproduced on a production
  build to rule out a dev-mode artifact. One fix in the primitive covers all eleven dialogs.
  - **Stabilization update (S-03/S-04, `packages/design-system/src/lib/use-restore-focus.ts`)**: the
    original fix captured the element to restore in Radix's `onOpenAutoFocus` handler, which fires
    AFTER commit. Two patterns defeated it there and both were reproduced live: (a) a native `autoFocus`
    on a field inside the dialog (e.g. `ReopenActionDialog`'s `<Textarea autoFocus>`) moves focus onto
    that field during commit, before `onOpenAutoFocus` ran — the captured "previous" element ended up
    being the dialog's own field, gone once the dialog closes, so focus fell back to `<body>`; (b) a
    dialog opened from a `DropdownMenuItem`'s `onSelect` captured the menu ITEM, which unmounts during
    the menu's own exit animation, so the restore target no longer existed at close time either. The fix
    now captures `document.activeElement` during React's RENDER phase — via `FocusRestoreAnchor`, a tiny
    component mounted as the dialog content's first child, below Radix's own `Presence` boundary, so it
    remounts fresh every open — strictly before ANY commit-phase work, including `autoFocus`, regardless
    of where in the tree it sits. If the captured element is inside `[role="menu"]`, it is resolved to
    that menu's own trigger via `aria-labelledby` (Radix's `DropdownMenuContent` always sets it) before
    the menu item can unmount. `ConfirmDialog` (`packages/design-system`, 34 callers, F-62) now uses the
    exact same hook — it never had any focus-restoration handling of its own before this fix, and its
    confirm button's own `autoFocus` was subject to the identical race. `DialogContent` also gained a
    default `max-h-[90vh] overflow-y-auto` (S-06) — overridable per caller via `className` (`cn` merges
    conflicting Tailwind utilities, so a caller's own `max-h-[85vh]`/`overflow-hidden` wins over the
    default) — converging the ~25 of 36 dialogs that previously had no height cap at all with the
    majority of the 11 that already set one.
- **`select.tsx`** — this file had *already* deviated from the CLI output by overriding shadcn's own
  `position="popper"` default to `"item-aligned"`; the popper styling sat in the file as dead code. That
  override is the root cause of F-17 (the listbox staying open in Firefox). The change **restores** the
  upstream default, so this file is now closer to the CLI output than it was.
- **`avatar.tsx`** — contrast fix; the fallback initials were 4.39:1, under the 4.5:1 threshold (SC 1.4.3).
- **`sheet.tsx`** — the screen-reader close label was hardcoded English, which CLAUDE.md §11.1 forbids.
  - **015 update (T001)**: `Sheet` is built on the very same `@radix-ui/react-dialog` primitive as
    `dialog.tsx`, so it carried the identical focus defect described above, unfixed — modal content
    hard-codes `onCloseAutoFocus` to focus a registered `Sheet.Trigger`, and its `preventDefault()`
    also discards `FocusScope`'s own generic fallback; no caller in this platform renders a Radix
    trigger, so focus fell silently to `<body>` on every close (SC 2.4.3). This was not theoretical:
    it is the measured reason `specs/012-admin-roles-screen/STATE.md` §2.4 chose `Dialog` over
    `Sheet` for the roles panel. `SheetContent` now uses the SAME shared
    `useDialogFocusRestore`/`FocusRestoreAnchor` as `dialog.tsx` and `ConfirmDialog` — one
    mechanism for the platform, mounted as the content's first child, with `onCloseAutoFocus`
    composed in the same order — so the cause is removed rather than routed around. Covered by
    `apps/web/src/components/ui/sheet.test.tsx`; deleting the anchor fails four of its five tests,
    and the fifth is the one that guards the pt-BR close label above.
- **`checkbox.tsx`** — had no indeterminate state. Radix already models one (`checked=
  "indeterminate"` emits `aria-checked="mixed"` on the root and `data-state="indeterminate"` on
  root and indicator), but the generated primitive rendered the SAME `CheckIcon` for it, so "all of
  this module selected" and "some of this module selected" were indistinguishable on screen —
  CLAUDE.md §18.8 / 015 NFR-004: colour is never the only signal. A minus glyph, chosen by the
  indicator's own `data-state` in CSS (which keeps uncontrolled checkboxes correct too, and cannot
  drift from what Radix reports to assistive technology), now differs from the check in SHAPE. All
  eleven existing call sites — `my-actions-filters.tsx`, `permission-checklist.tsx`,
  `user-roles-dialog.tsx`, `requirement-controls-section.tsx`, `finding-links-section.tsx`,
  `incident-relationships-section.tsx`, `problem-relationships-section.tsx`, `report-form.tsx` and
  `risk-register-filters.tsx` — pass a controlled boolean and never `'indeterminate'`, so the change
  is inert for every one of them; that inertness is asserted, not assumed, in
  `apps/web/src/components/ui/checkbox.test.tsx`.
- **`table.tsx`** — found by `e2e/accessibility.spec.ts` (T085, 005-audit-findings) scanning
  `EngagementFindingsSection`'s "Achados" tab: `Table`'s own `data-slot="table-container"` wrapper
  (`overflow-x-auto`, no `tabIndex`) is unreachable by keyboard once its content genuinely overflows —
  axe's `scrollable-region-focusable`, a **serious** WCAG 2.1.1/2.1.3 violation. Every one of the 16
  other call sites across Risks/Controls/Compliance/Admin happened to fit within the viewport, so this
  was real and previously undetected, not new. `packages/design-system`'s own `DataTable` had already
  found and fixed the identical defect the same way (`tabIndex={0}` on the scroll wrapper) — this change
  reuses that exact, already-proven fix in the shared primitive itself, covering every current and
  future consumer, rather than patching the one call site that happened to surface it.

**The rule**: `apps/web/src/components/ui/` may no longer be regenerated wholesale. Re-running the
shadcn CLI over these six files would silently reintroduce a serious accessibility defect (five of the
six) or an English string, and nothing in CI would catch either — `e2e/accessibility.spec.ts` would,
which is why those regression tests exist. Anyone updating a primitive must diff against these six
deliberately and re-run that spec.

`plan.md`'s "(unmodified)" annotation is now inaccurate; it is left alone because `plan.md` is an
approved artifact, and this entry is the correction of record.

### D-16 — Never run the web build while the web dev server is up

`pnpm --filter @pharos/web run build` and `pnpm --filter @pharos/web run dev` write to the **same**
`apps/web/.next` directory. Running the build while the dev server is serving corrupts its cache: the
running process starts returning **500 on every route**, including `/`, and it does not recover on its
own — the process must be stopped, `.next` removed, and `dev` started again.

This has now happened twice in one day, both times during verification rather than during development,
which is exactly when it is least expected: once while closing an accessibility fix, and once while
running the build gate to verify the Impeccable tooling install. Both times it produced a symptom that
looks like a code defect — a blank page, a failing smoke test, a 500 at the root — and is not one.

**Rule**: before running the web build, stop anything serving on port 3000. If the application must stay
up for someone to use it, run the build in a separate checkout or accept that the dev server will need a
restart afterwards.

### D-17 — `prisma migrate deploy` never revalidates the checksum of an already-applied migration; a live database can silently disagree with the repository forever

Found 2026-09-11 (007-implementation-remediation, Frente A), verified against `pharos_grc_test`,
not inferred from documentation.

While a migration file was still being iterated on inside its own tracked folder
(`prisma/migrations/<name>/migration.sql`), a concurrent agent's own test suite ran
`globalSetup`, which calls `prisma migrate deploy` automatically. It picked up the file mid-edit,
twice, on two different contents:

1. **First pass**, against a version whose verification step still had a real defect: the
   migration failed partway through and Prisma correctly recorded it as failed
   (`applied_steps_count: 0`, `_prisma_migrations.rolled_back_at` set) — this is the tool working
   as designed, and `prisma migrate resolve --rolled-back <name>` was the correct, verified
   recovery, confirmed by `migrate status` returning to a clean state afterward.
2. **Second pass**, moments later against a *different* revision of the same file (already fixed
   on one point, not yet fixed on another) — this one **succeeded**, and Prisma recorded it applied.

The file was edited again after that second pass, to fix the remaining defect. **`prisma migrate
deploy` was run again afterward and reported "No pending migrations to apply" — no error, no
warning — even though the on-disk file no longer matched what had been applied.** `migrate status`
also reported "Database schema is up to date!". Querying `_prisma_migrations` directly showed the
mechanism: two rows for the same migration name, with **different checksums**, one `rolled_back_at`
and one `finished_at`. Prisma's own tracking table records enough to notice the disagreement, but
neither `deploy` nor `status` checks an *applied* migration's file checksum against what is
tracked — only pending migrations are diffed against the folder. A database can therefore drift
from the repository's migration history indefinitely, with every ordinary command reporting green.

**Why this is a trap, not a one-off**: anyone iterating on a migration file *in place*, inside the
real tracked folder, while any other process might run `migrate deploy` against the same database
(a CI job, another developer, another agent's test harness), is exposed to this — the window is
exactly as wide as "the file exists in the folder but the author considers it still a draft."
Nothing in the tool distinguishes a draft from a finished migration once one real apply attempt has
touched it.

**The fix for a disposable database (verified, exercised for real)**: recreate the schema rather
than write a corrective migration on top of a mistake that only ever existed on a throwaway
database — a corrective migration would encode the mistake permanently into every future
installation's history to fix something that exists only to be discarded. As the owner role,
against the test database only, in this order:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION pharos_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE pharos_grc_test TO pharos_app;
GRANT USAGE ON SCHEMA public TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pharos_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pharos_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pharos_app;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
```

— mirroring `docker/postgres/init/01-roles.sql`'s own steps 3-6 exactly, since dropping the schema
also drops `_prisma_migrations` itself along with every stale row in it. Then `prisma migrate
deploy` reapplies all migrations from empty, which incidentally is also the from-scratch
installation proof for whatever the current migration set produces. Verified end to end on
2026-09-11: 69 tables before, 0 after the rebuild, 69 again (all 48 migrations, including the one
that had drifted) after `migrate deploy` — exactly one row for the drifted migration afterward,
correct checksum, `TreatmentActionStatus` (the enum that migration drops) confirmed absent.

**Standing rule this establishes**: never leave a migration file live inside the real, tracked
`prisma/migrations/` folder while it is still being iterated on and any other process might run
`migrate deploy` against a database it could reach. Draft it outside that folder (or in a branch/
worktree nobody else's harness touches) until it is genuinely final, then move it in as one
finished artifact — never edit it in place after the first real apply attempt, successful or not.

This matters more from here on, because the UI/UX phase (CLAUDE.md §18) runs a dev server and a build
loop side by side by design. Recovery is:

```
# stop whatever is listening on 3000, then
rm -rf apps/web/.next
pnpm --filter @pharos/web run dev
```

Playwright's own `webServer` block is unaffected by this rule — it sets
`reuseExistingServer: !process.env.CI`, and `PLAYWRIGHT_SKIP_WEB_SERVER=true` points the suite at an
already-running stack, which is how to run E2E against a server someone else started.

### D-18 — Prisma migration commands read `DATABASE_MIGRATION_URL`, not `DATABASE_URL` — overriding only the first still hits the wrong database

Found 2026-09-11 (008-incidents-problems, foundation), the same evening as D-17. A second trap, a
different mechanism, both costing real time.

`schema.prisma`'s datasource block declares two URLs:

```prisma
datasource db {
  url        = env("DATABASE_URL")
  directUrl  = env("DATABASE_MIGRATION_URL")
}
```

`prisma migrate deploy`/`migrate diff`/`migrate status` connect via `directUrl`
(`DATABASE_MIGRATION_URL`, the `pharos_owner` role) — never `url`. Overriding only `DATABASE_URL` in
the shell before one of these commands (`DATABASE_URL="$TEST_DATABASE_URL" pnpm exec prisma migrate
deploy`) changes nothing about which database the migration actually runs against: Prisma silently
falls back to whatever `DATABASE_MIGRATION_URL` resolves to from `.env` (the developer's own
database, `pharos_grc`) — and the CLI's own "Datasource" banner **is not proof of the opposite**: on
this exact mistake it printed `pharos_grc_test` while measurably connected to `pharos_grc`, because
by the time it prints that line it has already resolved `url`, not `directUrl`, for display.

**What actually happened**: a migration meant only for the test database was applied to the
developer's database instead, real but recoverable — see `specs/008-incidents-problems`'s own
research/report for the full account and how it was verified safe. The verification method matters
more than the specific incident: **query the database directly (`psql`) to confirm which one a
command actually touched — never trust the tool's own printed banner**, the same standing lesson
D-17 already drew for `migrate status`'s "up to date" message.

**The correct override, both variables, every time a Prisma migration command must target
something other than the default `.env`**:

```bash
DATABASE_URL="$TEST_DATABASE_URL" DATABASE_MIGRATION_URL="$TEST_DATABASE_MIGRATION_URL" \
  pnpm exec prisma migrate deploy
```

**A safer path than remembering both variables by hand**: `apps/api/test/integration/support/
global-setup.ts` already does exactly this mapping internally
(`DATABASE_URL: TEST_DATABASE_URL, DATABASE_MIGRATION_URL: TEST_DATABASE_MIGRATION_URL`) for every
integration/contract test run — `pnpm run test:integration`/`test:contract` is the tested,
already-correct way to exercise a migration against the test database, and should be reached for
before a manual `prisma migrate deploy` invocation, not after one goes wrong.

**Standing rule this establishes**: before running any `prisma migrate *` command against a
database other than whatever `.env` names by default, override **both** `DATABASE_URL` and
`DATABASE_MIGRATION_URL` (`TEST_DATABASE_URL`/`TEST_DATABASE_MIGRATION_URL` for the test database),
and confirm the target afterward by direct query — never by the command's own printed output.

### D-19 — Two closed enums carry an inert, undeclared value in both local databases, and cannot be made to forget it

Found 2026-09-11 (008-incidents-problems, foundation), a direct consequence of D-18 above.

The migration that produced D-18's incident originally extended `ActionOriginType` with `INCIDENT`/
`PROBLEM`, applied — before the mistake was caught — to both `pharos_grc` and `pharos_grc_test`.
`test/unit/action-model-convergence-guard.spec.ts` (a pre-existing, enforced 1:1 guard between every
`ActionOriginType` member and a real, registered `ActionOriginAccessor`) correctly refused to let
this stand without the accessor — four methods, one needing a scope-filtered repository query, that
this pass judged unsafe to write untested at that hour (see `specs/008-incidents-problems/spec.md`
FR-016's own dated note). `schema.prisma` and the migration file were corrected in place to drop the
extension before it was committed.

**What this does not fix**: PostgreSQL has no `ALTER TYPE ... DROP VALUE`. Both `pharos_grc` and
`pharos_grc_test` permanently carry `INCIDENT`/`PROBLEM` as physically valid `ActionOriginType`
values, even though `schema.prisma` — and every fresh database this migration history produces from
here on — does not declare them. Verified by direct query on both databases
(`SELECT enum_range(NULL::"ActionOriginType")`).

**Why this is safe to leave, not a defect to chase**: no code path anywhere in this repository ever
writes `ActionOriginType.INCIDENT`/`PROBLEM` — the accessor that would make either reachable does
not exist. An unused enum value is inert in PostgreSQL indefinitely; it is drift between "what the
schema file declares" and "what these two specific, already-migrated databases can physically hold,"
never a data-integrity or authorization risk. `PROBE_RECORD`, permanently stuck in
`AttachableEntityType`/`AuditEntityType`/`CommentableEntityType` since the SC-011 probe
(`docs/deferred-findings.md`), is the same class of residue, tolerated the same way.

**Standing rule this establishes**: a database that received a migration later corrected in place
(D-17's own standing rule exists to prevent this, but a mistaken target — D-18 — bypasses it, since
the migration file itself was correct at the moment it ran) may permanently disagree with
`schema.prisma` for any enum value it grew. The only way to make it agree again is D-17's own
schema-rebuild recipe (`DROP SCHEMA public CASCADE`, reapply from empty) — worthwhile for the test
database when a future pass needs a truly clean comparison; not worth it here for one inert value on
two databases that are otherwise correct.

> **Resolved, 2026-09-11, same evening.** The accessor this entry named as missing
> (`IncidentActionOriginAccessor`/`ProblemActionOriginAccessor`) was built the same night, tested
> (refusal, live-scope-by-reassignment, and the convergence guard confirmed failing without the
> registration — see `specs/008-incidents-problems`'s own report), and `ActionOriginType.INCIDENT`/
> `PROBLEM` were added back to `schema.prisma` in a **separate**, dated migration
> (`20260911030000_action_origin_type_add_incidents_problems`) — deliberately apart from the
> foundation migration, so the two decisions (build the tables; grow this specific enum once its
> accessor is real) stay legible as two decisions, not one. That migration uses
> `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, verified directly against `pharos_grc_test` — a database
> that already physically carried both values from the accident this entry describes — applying
> cleanly with no error and no duplicate, and reporting "No pending migrations" on immediate re-run,
> the same as it would against a genuinely fresh database. The **drift itself never gets erased by
> this** — `pharos_grc` and `pharos_grc_test` already had the values before this migration ran, so
> nothing changed there — what changed is that `schema.prisma` and every future fresh database now
> agree with what those two already held. This entry stays as the historical record of how that
> drift came to exist; it is not itself still an open problem.

### D-20 — E2E role provisioning paged only the first 100 admin roles, and stopped finding roles seeded past that page

Found by the journey agent (`apps/web/e2e/support/admin-session.ts`, `findAdminRoleByName`, line
~585). Both E2E provisioning call sites used to fetch exactly one page
(`page=1&pageSize=100`) of `GET /admin/roles` and `.find()` the target role within it — silently
correct only for as long as that role happened to sort within the first 100 rows. The admin roles
endpoint contract (`ListRolesQueryDto`) gives no name/search filter, only `page`/`pageSize`, so
paging until the role is found or the list is genuinely exhausted is the only option the contract
supports. Against a development database that only accumulates roles across sessions — twelve
system roles seeded today, more with every module — a target role sorting past page one made this
throw "no such role," which reads as a missing or misapplied seed rather than what it actually was:
a lookup that gave up one page too early.

**Fix**: `findAdminRoleByName` now loops pages until the role is found or `totalPages` is
exhausted. Delivered in commit `22021d2`. `specs/008-incidents-problems/STATE.md` §9 describes the
episode in full.

### D-21 — The login form silently discarded a value typed before React hydration

Diagnosed against CI run `34610189725` (WebKit-isolated job, real CPU throttling), not against a
local run. A value typed into the email/password fields before React finished hydrating was lost:
the DOM showed the typed text, but the form's own state never picked it up, so submission sent an
empty or stale value. `apps/web/src/app/(public)/login/login-form.tsx` (~line 13) and its test
(`login-form.test.tsx`, ~lines 5 and 113) record the regression; the E2E harness
(`apps/web/e2e/support/admin-session.ts`, ~lines 123 and 212, and `auth.spec.ts` ~line 79) works
around it by verifying-and-retrying the fill instead of trusting a single React change event.

**Fix**: delivered in commit `19d73f7`.

**Open finding**: the pattern this regression exposed — a shared form `Controller` that can lose a
value typed before hydration — is not proven confined to the login form. **F-56** in
`docs/deferred-findings.md` is the open, unresolved generalization of this defect to every other
form built on the same shared pattern.

### D-22 — Bootstrap sequence for a clean clone, and the traps paid for reconstructing this environment

The labels `D-20` and `D-21` already existed as comments in production and test code (see the two
entries immediately above) before either was recorded in this file. That collision was discovered
this session, while drafting this entry under the same numbers; the two entries above close the gap
so a `grep` for `D-20`/`D-21` now lands on a true explanation instead of nothing, and this entry was
renumbered to `D-22` to stop colliding with them.

Found 2026-09-11: the previous local working tree for this project was corrupted in an SSD transfer
and abandoned; the repository was recovered from GitHub into a genuinely clean clone. Nobody had
previously needed to write the clean-clone bootstrap sequence down end to end, because no session had
actually started from nothing before. Five real traps were paid for getting from clone to a working,
verifiable local environment; all five are recorded here so the next clean-clone session recognizes
them by symptom rather than rediscovering them.

**Trap 1 — running the web unit suite before the design system is built looks like a mass
regression, and is a missing build step.** A clean clone has no `node_modules`, no `.env` (both
gitignored), and no `dist/` for the workspace's internal packages (also gitignored). Running
`pnpm --filter @pharos/web run test:unit` before building `@pharos/design-system` produced, measured
directly this session, **77 of 110 test files failing**, all with the literal error
`Failed to resolve import "@pharos/design-system/components"`. This is not a regression in
`apps/web`, in the design system, or in any application code — it is exactly the missing step
`.github/workflows/ci.yml`'s own `test:unit` job comment already names: "@pharos/web imports the
BUILT design system (its `dist/` is gitignored), so the package must be compiled before this suite
can resolve it." After `pnpm --filter @pharos/design-system run build`, the same 110 files pass, 596
tests. Recognize this specific symptom — the import-resolution string above, on a large fraction of
the suite at once — as a bootstrap-ordering issue, not a code defect, before investigating further.

**Trap 2 — `apps/api` resolves `.env` from its own directory, never from the repository root.**
`apps/api/prisma.config.ts` runs `import 'dotenv/config'`, and `pnpm --filter` invokes the package's
scripts with `cwd=apps/api` — so every Prisma command and every `apps/api` script reads
`apps/api/.env`, not the root `.env`. Both files must exist, with `SEED_ADMIN_PASSWORD` set in
whichever file(s) the command path in use actually reads (never record the value itself in this
document — only that it must be set). `apps/web` needed no `.env` of its own for any command in the
sequence below on this pass.

There is a single `.env.example`, at the repository root — there is no separate
`apps/api/.env.example` — and it serves both destinations below.

**The minimal correct bootstrap sequence for a clean clone, verified this session:**

```bash
pnpm install --frozen-lockfile
cp .env.example .env
cp .env.example apps/api/.env   # set SEED_ADMIN_PASSWORD in both — value never recorded here
pnpm --filter @pharos/api run db:generate
pnpm --filter @pharos/api exec prisma migrate deploy
pnpm --filter @pharos/api run db:seed
pnpm --filter @pharos/api-types run generate && pnpm --filter @pharos/api-types run build
pnpm --filter @pharos/design-system run build

# Optional, final step — only needed for a production build, not for the unit suites
# above. See Trap 3 below for why these two variables are required.
API_INTERNAL_URL=http://localhost:3001 APP_ORIGIN=http://localhost:3000 pnpm --filter @pharos/web run build
```

**Trap 3 — `pnpm run build` at the root fails in `apps/web`, with a config-validation error, not a
compile error.** `pnpm --filter @pharos/web run build` (`next build`) fails on a clean clone with the
literal message:

```
Failed to load next.config.ts
Error: Invalid apps/web environment configuration:
  - API_INTERNAL_URL: API_INTERNAL_URL is required (see .env.example) — the ADR-014 rewrite has no default target.
  - APP_ORIGIN: APP_ORIGIN is required (see .env.example).
```

Cause, measured: `apps/web/next.config.ts` imports `src/lib/env.ts`, which validates both variables
at module load and throws synchronously — `next build` fails before compiling anything. `apps/web`
has no `.env` of its own in this session's provisioning (deliberately: no other command in the
sequence above needed one), and the root `.env` is never read by `next build`.

CI already handles this, and its own comment explains why: `.github/workflows/ci.yml`'s `build` job
(around lines 198-205) declares `API_INTERNAL_URL: http://localhost:3001` and
`APP_ORIGIN: http://localhost:3000` as job-level `env`. The equivalent verified locally this session,
as an optional final bootstrap step (needed only for a production build, not for the unit suites
above), is passing both on the command line:

```bash
API_INTERNAL_URL=http://localhost:3001 APP_ORIGIN=http://localhost:3000 pnpm --filter @pharos/web run build
```

Creating `apps/web/.env` with the same two variables is the alternative for anyone who prefers a
standing file — **not adopted this session**, and not verified as such; only the command-line form
above was actually run and confirmed.

**Trap 4 — running the local E2E suite without exporting the seeded credentials reports SUCCESS
having run almost nothing.** Measured: `pnpm exec playwright test --project=chromium`, run from
`apps/web` with the API and the web dev server already up, finished with **exit code 0**, "4 passed,
113 skipped", in 24 seconds. Cause, verified in code, not assumed:
`apps/web/e2e/support/admin-session.ts` reads `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from
`process.env` at module load, and `requireSeedCredentials()` calls `test.skip(true, ...)` when
either is missing — **outside CI**. Inside CI the same function throws and fails instead, on
purpose; its own comment names this behavior as the F-33 fix and describes the exact CI risk ("a
misconfigured pipeline can report success for a suite that never ran its authenticated scenarios").
What this measurement adds is that **locally the same trapdoor stays open by design**: an agent or
developer running E2E without those two variables sees green and has run almost nothing. Playwright,
run from `apps/web`, does not load the monorepo root's `.env`.

**The verified way to run E2E locally:**

```bash
# from apps/web, with the API (3001) and the web dev server (3000) already running
set -a && . ../../.env && set +a
PLAYWRIGHT_SKIP_WEB_SERVER=true pnpm exec playwright test --project=chromium
```

`SEED_ADMIN_PASSWORD`'s value is never recorded here — only that it must be set in `.env` for this to
run the real, authenticated scenarios.

**Recognition signal, the most useful part for whoever hits this**: a local E2E run that finishes in
a few seconds with almost everything `skipped` and exit code 0 is not a fast suite — it is a suite
that did not run. Check the `skipped` count, never only the exit code.

**Trap 5 — the native `pharos_grc` database survived the lost working tree, and its bootstrap
administrator's password did not.** The development database is PostgreSQL native, outside the
repository (D-1), so it survived the SSD loss that took the working tree: it still holds 101 users
accumulated across previous sessions, including the bootstrap administrator `admin@example.local`.
The seed script is idempotent by design and deliberately never overwrites `passwordHash` or
`mustChangePassword` on a credential that already exists — documented in the header of
`apps/api/prisma/seed/platform.seed.ts`. That account's password lived only in the lost local tree
(never in this repository), so re-running `db:seed` with a newly-chosen `SEED_ADMIN_PASSWORD` did
not recover it. Playwright's `globalSetup` failed with the literal message:

```
[global-setup] Could not settle bootstrap administrator: Neither the seeded nor the rotated password authenticated bootstrap administrator <admin@example.local> (login returned 401, then 401 for the rotated password).
```

**Solution adopted, non-destructive and reversible**: seed a second, new bootstrap administrator
under a different email, with a password known to this session, without touching the existing
`admin@example.local` account or any other data:

```bash
SEED_ADMIN_EMAIL="admin-recovery@example.local" pnpm --filter @pharos/api run db:seed
```

then export that same `SEED_ADMIN_EMAIL` (alongside `SEED_ADMIN_PASSWORD`, already required by
D-5) for the E2E run. `upsertBootstrapAdmin` creates the account with the administrator role and
`mustChangePassword = true`; Playwright's `globalSetup` performs the one-time forced password
rotation itself, before any worker starts. Verified: `globalSetup` afterward reported `bootstrap
administrator <admin-recovery@example.local>: rotated.`, and the suite went from collecting 4
runnable Chromium tests (113 skipped) to collecting and running all 117.

**Why not the destructive alternative**: dropping and recreating the development database would
have recovered a working bootstrap administrator too, but at the cost of the 101 accumulated users
and everything else built up across every prior session — the native database is precisely the
asset that survived the working-tree loss; erasing it to fix one account's password would trade a
solved problem for a much larger one. The password itself is never recorded here — only that
`SEED_ADMIN_PASSWORD` must be set in `.env` for either path to work.

**Checksum divergence on the newest migration — D-17 recurring, verified object-by-object as NOT
structural.** `20260911020000_incidents_problems_foundation_baseline` carries, in
`_prisma_migrations`, a checksum different from the file on disk — in **both** local databases,
`pharos_grc` and `pharos_grc_test`. Cause: the migration was applied to both databases at 02:55/02:58
and the file was only committed at 03:55 (commit `064c9d1`) — what ran was a draft, edited again
before the commit that fixed it. `prisma migrate deploy` never revalidates the checksum of an
already-applied migration, exactly as D-17 already documents; this is the same trap recurring against
a different migration.

Verified object-by-object this session, not assumed, that the divergence is cosmetic rather than
structural:

- the other 50 migrations have an identical checksum between database and disk;
- the 4 enums the file declares (`IncidentSeverity`, `IncidentStatus`, `ProblemSeverity`,
  `ProblemStatus`) exist in the database with exactly the same values, in the same order;
- the 18 indexes the file declares all exist, and the only indexes in the database beyond those are
  the 7 primary keys (declared inline in `CREATE TABLE`, not via a separate `CREATE INDEX`);
- the 7 tables declare 74 columns combined (20 + 19 + 7×5) and the database has exactly 74.

**Conclusion**: the divergence is cosmetic (a comment/whitespace difference between the applied draft
and the committed file), the two local databases are representative of what the committed migration
produces, and a local test battery run against them is valid evidence of the migration's real effect.

**NOT verified**: rebuilding the test database from scratch, from the versioned migrations alone
(D-17's own recipe — `DROP SCHEMA public CASCADE`, reapply from empty), would be the definitive proof
that the committed file reproduces the same schema unaided. That rebuild was not performed this
session. This stays an open verification, not a resolved one.

### D-23 — Local auth rate limits should match the CI E2E job's already-ratified values, not production's

Found 2026-09-11 (009-indicators-reports, Phase 7), while diagnosing why a full local Chromium E2E
run kept failing on what looked like wrong-password errors. This machine's `apps/api/.env` carried
`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=5` and `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=20` — the same values
`.env.example` documents for **production**.

`.github/workflows/ci.yml`, in the E2E job (around lines 710-726), already overrides both, job-scoped,
to:

```yaml
AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS: "200"
AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS: "1000"
```

against `"5"`/`"20"` in every other job, with its own comment (lines 709-720) explaining why these
values are local to the E2E job and are **never** production values:

> Raised well above the other jobs' "5"/"20" defaults, CI-job-local only (never a production value):
> F-16's worker-admin pool means `signInAsWorkerAdmin`/`signInAsSeededUser` legitimately makes ONE
> guaranteed failed attempt (the stale pre-rotation password, tried first, by design) on every call
> after an account's very first sign-in in this database -- and a single worker's account is reused
> across many spec files plus Playwright's own CI retries. Left at the real default, worker-0's own
> account was observed locking ITSELF out (`AUTH_LOCKOUT_MINUTES`) well before this run finished,
> purely from its own legitimate, expected traffic. All workers also share this runner's one loopback
> IP, so the per-origin dimension needs the same headroom, multiplied by the worker-pool size.

**This is exactly why F-48** (`docs/deferred-findings.md`) hurts locally and was never visible in CI:
the local environment was running production's tighter budget against a workload CI already
recognized needs a wider one, and gave itself permission to widen only for that job.

**Action taken this session**: the coordinator started the local API with the same
`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=200`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=1000` values the CI E2E job
already uses, matching an environment-parity decision the repository had already ratified for exactly
this workload — not inventing a new one.

**Explicitly not a security-control weakening**: production's values in `.env.example` remain `5` and
`20`, untouched by this session. Only the local developer's `.env`, for running the E2E suite, was
changed — the same distinction the CI workflow itself already draws between its E2E job and every
other job.

**Not a full fix for F-48 at the time this entry was written**: F-48's own root cause (failed login
attempts consuming the origin budget during long local runs) was unchanged by this — this entry only
brought the local environment's configuration in line with what CI already does, closing the specific
gap where local and CI disagreed on which budget to run against. Separately, **F-59**
(`docs/deferred-findings.md`) documents a second, unrelated rate limiter — the global `ThrottlerGuard`
— that also produces 429s during local E2E runs and is not affected by this entry. **Both F-48 and
F-59 are RESOLVED as of 2026-09-19** (rodada 023) — see `docs/deferred-findings.md` for the current
evidence and formal decisions; this D-23 entry stays as the historical record of the specific
gap it closed, not a claim that either finding remains open.

> **Note (2026-09-14)**: on this reference machine, D-23 has **not** been applied. The local
> `apps/api/.env` still carries production's auth rate-limit values, as reported by the
> implementation session that ran the 015 closing regression. This is a fact about a running
> process's environment, not the repository — `.env` is gitignored and was not read or quoted to
> confirm it; the variables in question are `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` and
> `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` (`.env.example` lines 187/193, both `5`/`20`, i.e. the
> production defaults this entry says a local E2E run should not run against). "Action taken this
> session" above describes a **previous** session (009-indicators-reports, Phase 7, 2026-09-11)
> raising them for that session's own running process; it was never a repository change (`.env` is
> not committed), so it does not persist across machines, restarts, or later sessions on the same
> machine. Anyone running the local Chromium E2E suite should re-apply the CI E2E job's values
> (`AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=200`, `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=1000`) to their own
> `apps/api/.env` before relying on F-48 being closed locally.

> **Update (2026-09-19, rodada 023 de saneamento de findings)**: the gap this note describes is
> fixed at its root now, not worked around per-session again. `.env.example` itself — the
> repository template every `Copy-Item .env.example .env` starts from — now defaults
> `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=200`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=1000`, with each
> variable's own comment explaining why (F-48, `docs/deferred-findings.md`, now RESOLVIDO). A
> **new** clone, or a fresh `.env` copied from the template, gets the CI-ratified values by
> construction — no manual re-application, no session-scoped fix that evaporates on restart.
>
> This does **not** retroactively fix an `.env` that already exists on a machine (gitignored,
> never touched by a template change) — this very reference machine's own `.env` was checked again
> while writing this update and still reads `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS=5`/
> `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS=20`, exactly as this note originally reported. That is expected,
> not a regression of this fix: an existing `.env` only picks up a new template default through a
> fresh copy or a manual edit, by design (a template change must never silently rewrite a
> developer's own configured file). Anyone hitting F-48/F-43's symptom on a machine with an older
> `.env` should still apply the values above by hand, or re-copy from the current
> `.env.example`, exactly as this note's last paragraph already said — that guidance did not
> change, only its root cause did.

### D-24 — This machine's `.env` cannot run the fixture-dependent E2E, and its seeded admin password is stale

Measured 2026-09-18, while validating `018-incident-detail-experience` from this workstation. Both
findings are about THIS environment's `.env`, not about the product, and neither is a defect in any
module — they are recorded because every future module in the detail-modernization queue will hit
them, and each one costs a long, misleading debugging session before it is recognised.

**1. `SEED_ADMIN_PASSWORD` is stale — the seeded value returns `401`.**

The value in the repository root `.env` does not authenticate. The password that does is the one
the E2E suite permanently rotates to (`admin-session.ts` appends `-E2E-1`, the rotation D-23 and
F-48 already describe). Measured directly against `POST /api/v1/auth/login`:

| password | HTTP |
|---|---|
| `.env`'s own `SEED_ADMIN_PASSWORD` | `401` |
| `Dev-Local-Only-P4ssw0rd!` (the `.env.example` default) | `401` |
| `Dev-Local-Only-P4ssw0rd!-E2E-1` (rotated) | **`200`** |

Playwright's `global-setup` tries the configured password and then its `-E2E-1` variant, so passing
the UNROTATED default is what makes a local run work — not the value currently in `.env`:

```bash
# from apps/web, with the API (3001) and the web dev server (3000) already running
set -a && . ../../.env && set +a && export SEED_ADMIN_PASSWORD='Dev-Local-Only-P4ssw0rd!'
npx playwright test <spec> --workers=1 --project=chromium --reporter=line
```

Without exporting the `.env` at all, `playwright.config.ts` refuses to load: `API_INTERNAL_URL` and
`APP_ORIGIN` are required and have no defaults (ADR-014).

**2. `SEED_DEV_FIXTURES=false` makes every fixture-dependent E2E test unrunnable here.**

`global-setup` announces it plainly and continues:

```
[global-setup] SEED_DEV_FIXTURES is not 'true' — skipping fixture account (riskAnalyst)
               <fixture-risk-analyst@pharosgrc.local> (not seeded for this run).
```

`risk-detail-navigation.spec.ts`'s "a caller without `audit:view` never sees the Auditoria leaf"
calls `signInAsFixtureUser(page, FIXTURE_USER_EMAIL.riskAnalyst)`, so it cannot pass with the
account absent. **The visible symptom is misleading**: the repeated failed sign-ins trip the auth
rate limiter, and the page ends up showing "Muitas tentativas. Tente novamente mais tarde.", which
reads exactly like F-59. It is not F-59 and it is not a regression — the account simply does not
exist. Confirmed by `POST /api/v1/auth/login` for that address returning `429` after the attempts,
against `SEED_DEV_FIXTURES=false` in `.env`.

Classify a local E2E failure by checking the `global-setup` banner FIRST: an account it announced as
skipped can never authenticate, however the failure presents itself downstream.

**3. `--workers=1` is not what fails — a server carrying hours of accumulated session state is.**

Measured 2026-09-19, closing F-56 (rodada 023, saneamento de findings). During the same session's
own E2E verification, `--workers=1` against `next start`/`node dist/src/main.js` processes that had
already served an entire session's worth of test traffic (a full 822-test parallel run, plus two
more invocations) hung twice, reproducibly, with near-zero CPU — no progress for minutes at a time.
Restarting BOTH servers from a clean process (`next start --port 3000`, `node dist/src/main.js`) and
re-running the exact same single-worker command against the fresh servers produced two clean,
fast passes (2/2 in 6.8s, 1/1 in 9.1s). The coordinator then independently confirmed the general
case: `accessibility.spec.ts`, `--workers=1`, production build, freshly restarted servers —
**168/168 passed in 8.3 minutes, exit code 0**.

**The property belongs to the accumulated load, not to the worker count.** `--workers=1` is F-59's
correct, working policy — it does not hang on its own, against a fresh server. What does not work
is a long E2E run, at any worker count, against a server this session has already hammered for a
long time. Do not read a stall under `--workers=1` as grounds to raise parallelism back up — that
would undo exactly what F-59 closed on. The mitigation is restarting both servers before a full
local battery, not increasing worker count. See F-59's own 2026-09-19 addendum in
`docs/deferred-findings.md` for the full before/after numbers.

### D-25 — A change to `packages/design-system` does NOT reach the running app until it is rebuilt

Measured 2026-09-18, during `020-action-detail-experience`. `apps/web` imports
`@pharos/design-system/components`, and that specifier resolves through the package's `exports`
map to **`dist/`**, never to `src/`. The dev server therefore keeps serving the last BUILT
component no matter how many times the source changes.

Caught in the act: `detail-layout.tsx` had been edited at `2026-09-18 03:46` while
`dist/components/detail-layout.js` was still the artefact from `2026-09-17 08:48`. The
implementation was correct and its unit tests were green — Vitest resolves the workspace package to
source, so the tests exercised the NEW code — but every rendered check, including the "no-op
confirmed for the three existing consumers" claim, had been made against a page still running the
OLD component. Nothing was wrong with the change; the evidence for it simply did not exist yet.

```bash
pnpm --filter @pharos/design-system run build
```

Run it before ANY rendered verification, `ui-capture.mjs` run, or E2E pass that is supposed to
exercise a design-system change. A capture taken against a stale `dist/` is a capture that lies,
and it lies in the most dangerous direction: it shows the screen as it was before the fix, while
the reviewer reads it as proof that the fix is harmless.

`dist/` is gitignored, so CI always builds fresh — this trap exists only locally, which is exactly
why it is easy to miss and worth writing down. Unit tests passing is NOT evidence that the running
app has the change.

### D-26 — Sourcing the root `.env` wholesale into `apps/web`'s production build breaks it

Measured 2026-09-19, during `024-dashboard-v2` Fase A. D-24's own documented pattern for a local
E2E run —

```bash
set -a && . ../../.env && set +a && ...
```

— exports every variable in the root `.env`, including `NODE_ENV=development` (line 22 of that
file). That is harmless for `playwright test` and for `next start` against an already-built
`.next/`, but applying the exact same pattern to `next build` breaks it:

```
Generating static pages (0/30) ...
Error: <Html> should not be imported outside of pages/_document.
Read more: https://nextjs.org/docs/messages/no-document-import-in-page
Error occurred prerendering page "/404". Read more: https://nextjs.org/docs/messages/prerender-error
Export encountered an error on /_error: /404, exiting the build.
```

`next build` normally sets `NODE_ENV=production` itself; forcing `development` ahead of it through
the sourced `.env` breaks Next's prerender of the special `_error`/`404` pages. **Confirmed
pre-existing, not introduced by this work**: reproduced on a clean `3b3251f` checkout (`git stash
-u`, `rm -rf .next`, then the exact command above) before any Dashboard V2 change existed.

The working invocation exports only the two variables `next.config.ts`'s own env validation
actually requires (`apps/web/src/lib/env.ts`), and leaves `NODE_ENV` alone so Next sets it itself:

```bash
export API_INTERNAL_URL=http://localhost:3001 APP_ORIGIN=http://localhost:3000
npm run build   # from apps/web — do NOT source the root .env for this one
```

This does not change what D-24 says about `playwright test` or `next start` — both of those are
unaffected by `NODE_ENV`'s value and the sourced-`.env` pattern remains correct for them. The
trap is specific to `next build`. Not fixed here: moving `NODE_ENV` out of the root `.env`, or
making `apps/web`'s build tolerate it, is an environment-configuration change shared with every
other consumer of that file, not a decision this rodada's dashboard-only scope owns.
