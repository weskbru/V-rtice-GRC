# Quickstart: Run and Validate the GRC Platform Foundation

> **Historical document, phase 001.** This is the phase-001 validation quickstart — it walks the
> nine user-story scenarios and success criteria of the GRC Platform Foundation as it stood when
> this spec was written. For current environment setup and day-to-day development across the whole
> platform (thirteen phases later), see [`docs/guides/development.md`](../../docs/guides/development.md). For the
> current test strategy and CI mapping, see [`docs/guides/testing.md`](../../docs/guides/testing.md). Section 1-3
> (prerequisites, first-time setup, environment variables) and the addendum in section 2 remain
> useful as a historical record and are still largely accurate, but `docs/guides/development.md` is the
> maintained source for setup steps going forward.

**Feature**: GRC Platform Foundation and Risk Management
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research/ADRs**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **API contracts**: [contracts/](./contracts/)

This is a **validation guide**, not an implementation guide. It brings the stack up and proves each
user story (US1–US9) and success criterion (SC-001–SC-016). It assumes no prior knowledge of this
repository.

The dev machine is **Windows 11 with PowerShell**. All commands below are PowerShell. Where a command
must run inside a container, it is prefixed with `docker compose exec`.

---

## 1. Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 22 LTS | `node --version` |
| pnpm | 9+ | `corepack enable; corepack prepare pnpm@latest --activate; pnpm --version` |
| Docker Desktop | current, running, Linux containers | `docker version` |
| Git | any current | `git --version` |
| Browser | current Chrome/Edge/Firefox | — |

Notes:

- The API uses `argon2`, a native module. Node 22 prebuilds cover Windows x64; if pnpm asks, approve
  the build script (`pnpm approve-builds`).
- Nothing is installed globally. Prisma, Vitest and Playwright run through pnpm scripts.
- PowerShell has no `export`. Set a variable for the current session with `$env:NAME = "value"` —
  persistent configuration belongs in `.env`.

---

## 2. First-time setup

```powershell
git clone <repository-url> vertice-grc
cd vertice-grc
pnpm install

# Environment file — every variable is documented in .env.example (see section 3)
Copy-Item .env.example .env

# Initial administrator password for the seed (never commit this)
$env:SEED_ADMIN_PASSWORD = "<choose-a-strong-password>"

# Infrastructure only: PostgreSQL 17 + Redis 7
docker compose up -d postgres redis
docker compose ps            # both must be "healthy" before continuing

# Schema and seed data
pnpm --filter ./apps/api exec prisma migrate deploy
pnpm --filter ./apps/api exec prisma db seed
```

Start both applications (two terminals, or one root `pnpm dev` if the workspace defines it):

```powershell
# Terminal 1 — NestJS API on http://localhost:3001
pnpm --filter ./apps/api dev

# Terminal 2 — Next.js on http://localhost:3000
pnpm --filter ./apps/web dev
```

Confirm the stack is up:

```powershell
Invoke-RestMethod http://localhost:3001/api/v1/health/live         # process liveness
Invoke-RestMethod http://localhost:3001/api/v1/health/ready        # PostgreSQL + Redis reachable
Invoke-RestMethod http://localhost:3000/api/v1/health/live         # proves the Next.js -> API rewrite
```

(the API's global route prefix, `/api/v1`, applies to its own health endpoints too — there is no
bare `/health/live` route; verified directly, a request to it returns `404`.)

Open <http://localhost:3000>. You must be redirected to the login screen.

**Single origin ([ADR-014](./research.md#adr-014-single-origin--nextjs-proxies-the-api))**: the browser
and every validation command below talk to `http://localhost:3000` only; Next.js rewrites `/api/*` to
the API. Calling `http://localhost:3001` directly bypasses the rewrite and is used only for health
checks.

### Full-stack alternative

To run everything in Docker instead of locally:

```powershell
docker compose up -d --build

# Migrations and seed run from the HOST, against the container's published
# port — NEVER `docker compose exec`. Substitute the actual published port
# (`POSTGRES_HOST_PORT` in docker-compose.yml) below.
$env:DATABASE_URL = "postgresql://vertice_app:<dev-password>@localhost:<published-port>/vertice_grc?schema=public"
$env:DATABASE_MIGRATION_URL = "postgresql://vertice_owner:<dev-password>@localhost:<published-port>/vertice_grc?schema=public"
pnpm --filter ./apps/api exec prisma migrate deploy
pnpm --filter ./apps/api exec prisma db seed
```

> **2026-09-11 addendum (007-implementation-remediation, D-25) — measured, superseding the two
> paragraphs this replaces.** `docker compose exec api pnpm exec prisma migrate deploy`/`db seed`
> (this section's own form until this addendum) **never worked and never could**:
> `docker/api.Dockerfile`'s runtime image ships neither `pnpm` nor the `prisma` CLI — verified
> directly against that Dockerfile's own build stages, not inferred. The host-based form above,
> against the container's published port, is the only form that has ever worked, and is what this
> document's own Section 5 already used. Separately, measured the same session: **F-12 and F-14 are
> resolved** — the packaged API image no longer crash-loops (built, started against real Postgres/
> Redis, its own `/health/ready` returned `{"status":"ok"}`) and neither image bakes in a nested
> `.env`. **F-13 splits in two**: the documented boot-validation failure never occurs on a real
> `docker compose up`, because `docker-compose.yml` already forces `SESSION_COOKIE_SECURE=true` —
> that half was never true as stated. The second half — "a browser would refuse the `Secure` cookie
> over `http://localhost`" — is **measured false for Chromium specifically**: a real Chromium engine
> stored, recognized and cleared the session cookie end to end, login through logout, through the
> rendered form. Scope is exactly Chromium — Firefox/Safari/published Chrome were not exercised.
> What remains genuinely open: this stack has no TLS terminator, so nothing beyond `localhost`
> works without one. **Playwright does *not* require Docker locally**: by default
> (`PLAYWRIGHT_SKIP_WEB_SERVER` unset) `playwright.config.ts`'s own `webServer` starts `pnpm dev`
> directly and reuses whatever API/web dev servers from section 2 above are already running — this
> document's own Section 5 was run and verified this way, against native PostgreSQL, with no Docker
> container involved. Docker Compose is what CI points the suite at
> (`PLAYWRIGHT_SKIP_WEB_SERVER=true`), not a local requirement.

### What the seed creates

Per [data-model.md section 14](./data-model.md#14-migration-and-seed-policy): the permission set, the
system roles `Platform Administrator`, `Risk Manager`, `Risk Analyst`, `Risk Approver`, `Auditor` and
`Read Only`, a root organizational unit, the default 5×5 risk methodology version, starter risk
categories/types/origins, and **one** administrator account whose password comes from
`SEED_ADMIN_PASSWORD` and which is flagged `mustChangePassword`. The seed contains no secret.

---

## 3. Environment variables

Copy `.env.example` to `.env` and adjust. **No real secret belongs in this file, in the repository, or
in any example.** In production every value below is supplied by the deployment environment (container
secrets or a secret manager), never by a checked-in file.

| Variable | Purpose | Safe development default |
|----------|---------|--------------------------|
| `NODE_ENV` | Runtime mode; gates cookie hardening and error verbosity | `development` |
| `APP_ORIGIN` | The single public origin. Used for the `Origin`/`Referer` CSRF check on state-changing requests | `http://localhost:3000` |
| `API_PORT` | NestJS listen port | `3001` |
| `WEB_PORT` | Next.js listen port | `3000` |
| `API_INTERNAL_URL` | Target of the Next.js `/api/*` rewrite and of server-component fetches | `http://localhost:3001` |
| `DATABASE_URL` | Application connection. Uses the **restricted** role — `INSERT`/`SELECT` only on `audit_event` | `postgresql://vertice_app:<dev-password>@localhost:5432/vertice_grc?schema=public` |
| `DATABASE_MIGRATION_URL` | Owner connection used by `prisma migrate` for DDL, trigger and privilege migrations | `postgresql://vertice_owner:<dev-password>@localhost:5432/vertice_grc?schema=public` |
| `TEST_DATABASE_URL` | Restricted-role connection used by the integration/contract/e2e test suites | `postgresql://vertice_app:<dev-password>@localhost:5432/vertice_grc_test?schema=public` |
| `TEST_DATABASE_MIGRATION_URL` | Owner connection used by `prisma migrate` against the test database | `postgresql://vertice_owner:<dev-password>@localhost:5432/vertice_grc_test?schema=public` |
| `REDIS_URL` | Session validation cache, permission/scope cache, rate-limit counters. Never authoritative | `redis://localhost:6379` |
| `SESSION_COOKIE_NAME` | Name of the opaque session cookie | `vgrc_session` |
| `SESSION_COOKIE_SECURE` | Sets the `Secure` flag. `false` only because local dev runs over plain HTTP | `false` (**`true` everywhere else**) |
| `SESSION_COOKIE_SAMESITE` | SameSite policy | `lax` |
| `SESSION_IDLE_TIMEOUT_MINUTES` | Inactivity expiry (FR-014) | `30` |
| `SESSION_ABSOLUTE_LIFETIME_HOURS` | Absolute lifetime regardless of activity (FR-014) | `12` |
| `PASSWORD_MIN_LENGTH` | Local password policy minimum length (FR-006) | `12` |
| `PASSWORD_REQUIRE_COMPLEXITY` | Enforce mixed character classes (FR-006) | `true` |
| `ARGON2_MEMORY_COST` | argon2id memory cost, in KiB | `19456` |
| `ARGON2_TIME_COST` | argon2id iterations | `2` |
| `ARGON2_PARALLELISM` | argon2id lanes | `1` |
| `THROTTLE_TTL_SECONDS` | Global API rate-limit window for the `@nestjs/throttler` budget, distinct from the auth-specific limits below | `60` |
| `THROTTLE_LIMIT` | Maximum requests per client within `THROTTLE_TTL_SECONDS` | `100` |
| `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS` | Failed sign-ins allowed for a single account before lockout (FR-008) | `5` |
| `AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS` | Failed sign-ins allowed from a single origin across all accounts before throttling (FR-008) | `20` |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | Throttle window | `300` |
| `AUTH_LOCKOUT_MINUTES` | Account lock duration once the limit is hit | `15` |
| `ATTACHMENT_STORAGE_DRIVER` | Storage adapter behind the `FileStorageProvider` port; only `local` exists in this release | `local` |
| `ATTACHMENT_STORAGE_PATH` | Local-disk adapter root for the `FileStorageProvider` port | `./storage/attachments` |
| `ATTACHMENT_MAX_SIZE_BYTES` | Per-file size cap (FR-097) | `26214400` (25 MB) |
| `ATTACHMENT_ALLOWED_MIME_TYPES` | Comma-separated allow-list (FR-097) | `application/pdf,image/png,image/jpeg,text/plain` |
| `LOG_LEVEL` | pino level | `debug` in dev, `info` otherwise |
| `LOG_PRETTY` | Human-readable log output locally | `true` in dev, `false` otherwise |
| `SEED_DEV_FIXTURES` | Gates the development-only fixture (one user per system role, a two-level org unit tree); must stay `false` outside local development | `false` |
| `SEED_ADMIN_EMAIL` | Identifier of the seeded administrator | `admin@example.com` |
| `SEED_ADMIN_PASSWORD` | **Placeholder only.** Supplied at seed time by the operator; the account is created with `mustChangePassword = true` | *(unset — must be provided)* |

If `SEED_ADMIN_PASSWORD` is absent or fails the password policy, the seed must fail rather than fall
back to a default.

Cookie, storage and observability behaviour behind these variables is specified in
[ADR-002](./research.md#adr-002-server-side-opaque-sessions-not-jwt),
[ADR-010](./research.md#adr-010-file-storage-behind-a-port-attachments-served-only-through-authorization)
and [ADR-012](./research.md#adr-012-observability-separated-from-audit).

---

## 4. Validation scenarios

Nine scenarios, one per user story, each executable by a human against the running application.

### Scenario 0 — Provision the validation users *(precondition for scenarios 2–9)*

The seed ships a single administrator. Everything else is created through the product, which also
exercises US8.

1. Sign in at <http://localhost:3000> as `SEED_ADMIN_EMAIL`. You are forced to change the password
   before reaching the dashboard (`mustChangePassword`).
2. Under **Administration → Organizational units**, create `OU-A` and `OU-B` as children of the root
   unit.
3. Under **Administration → Users**, create and assign:

   | User | Role | Organizational scope |
   |------|------|----------------------|
   | `analyst@example.local` | Risk Analyst | `OU-A` |
   | `manager@example.local` | Risk Manager | `OU-A` |
   | `approver@example.local` | Risk Approver | `OU-A` |
   | `auditor@example.local` | Auditor | Global |
   | `readonly@example.local` | Read Only | `OU-A` |
   | `outsider@example.local` | Risk Manager | `OU-B` |

   Set each initial password yourself; each account requires a change on first sign-in.

### Scenario 1 — Secure access to the GRC workspace (US1)

**Proves**: SC-001, SC-005, SC-010 · **Sign in as**: any provisioned user

1. Open <http://localhost:3000>; confirm you are redirected to `/login` and that no application route
   (`/dashboard`, `/risks`) is reachable while signed out.
2. Submit a wrong password. **Expected**: a generic failure message that does not reveal whether the
   account exists; no field-level hint; HTTP `401` with a problem+json body carrying no stack trace.
3. Repeat the wrong password past `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`. **Expected**: further attempts
   are throttled (`429`) with the same non-disclosing message.
4. Sign in with valid credentials. **Expected**: the GRC dashboard renders inside the shell (sidebar,
   header, content) in **under 10 seconds** from submit (SC-001); the header shows your identity; the
   sidebar shows only entries your permissions allow.
5. Inspect the dashboard areas. **Expected**: risks, pending approvals, overdue actions and items
   requiring review carry real data scoped to you; problems, incidents and controls are explicitly
   labelled planned or unavailable, with **zero** fabricated numbers (SC-013).
6. Open the profile page. **Expected**: name, email, roles and organizational unit match what was
   provisioned.
7. Sign out, then press the browser Back button. **Expected**: you land on `/login`, not a cached
   application page; replaying a request with the old cookie is refused.
8. Deactivate a user as administrator while that user is signed in, then act in their browser.
   **Expected**: the next request is refused and the user returns to `/login` (FR-017).
9. As `auditor@example.local`, open the audit trail. **Expected**: entries for authentication success,
   authentication failure, session creation, sign-out and session revocation, each with actor,
   timestamp, IP and user agent (SC-005).

To confirm inactivity expiry (FR-014) without waiting, restart the API with
`$env:SESSION_IDLE_TIMEOUT_MINUTES = "1"`, sign in, idle 90 seconds, then act. **Expected**: the
request is refused, the user is returned to `/login` with an explanation, and the session records
`revokedReason = EXPIRED`.

### Scenario 2 — Capture and maintain risk records (US2)

**Proves**: SC-002, SC-005, SC-006 · **Sign in as**: `analyst@example.local` (Risk Analyst, `OU-A`)

1. **Risks → New**. Save with required fields missing. **Expected**: field-level validation messages
   and nothing stored.
2. Complete title, description, category, organizational unit (`OU-A`) and owner; add two causes and
   two consequences as separate entries. Save as draft, navigate away, reopen.
   **Expected**: a unique human-readable code (`RSK-<year>-<sequence>`) is assigned and stable; the
   draft is intact on return; the whole flow takes under 5 minutes without documentation (SC-002).
3. Edit the title and the owner. **Expected**: changes persist; the audit trail shows previous and new
   values per changed field (SC-005).
4. Open the risk detail. **Expected**: structured sections (overview, assessment, causes and
   consequences, controls, treatment, actions, history, audit, attachments, comments) — not one flat
   form; sections you lack permission for are absent.
5. Sign in as `readonly@example.local` and attempt an edit through the API with the interface bypassed
   (request pattern in section 6). **Expected**: `403`, record unchanged (SC-006).

### Scenario 3 — Work the risk register at scale (US3)

**Proves**: SC-003, SC-004, SC-012, SC-015 · **Sign in as**: `manager@example.local` (Risk Manager, `OU-A`)

Seed volume first — see section 7.

1. Open **Risks**. **Expected**: paginated results with a stable order, a visible total count, and a
   page size no larger than the documented cap; no response is ever unbounded.
2. Combine filters for status + risk level + organizational unit. **Expected**: only records matching
   *all* filters appear, and the total updates accordingly.
3. Search a known code, then a word from a title, then a word from a description. **Expected**: each
   returns the matching records; locating a specific risk takes under 30 seconds (SC-003).
4. Sort by residual risk, then by next review date; page forward and back. **Expected**: order is
   stable and deterministic across pages.
5. Confirm a risk whose next review date has passed is flagged **overdue for review**, and that a risk
   which is both review-overdue and treatment-overdue shows both indicators separately.
6. Confirm high and critical levels are distinguishable **without relying on color alone** (icon, text
   label or shape), and that the register is fully keyboard-operable with visible focus (SC-012).
7. Apply filters, open a risk, return to the register. **Expected**: filters, search, sort and page
   position are preserved.
8. Filter to something that matches nothing. **Expected**: an empty state that says "no results for
   these filters", distinct from the "no risks exist yet" state.
9. Sign in as `outsider@example.local` (scoped to `OU-B`). **Expected**: no `OU-A` risk is listed, and
   requesting one directly by id returns `404` — not `403` — so existence is not disclosed (SC-015).

### Scenario 4 — Assess risks and preserve assessment history (US4)

**Proves**: SC-007, SC-005 · **Sign in as**: `analyst@example.local`

1. Open a risk → **Assessment** → new assessment. Enter inherent probability/impact and post-control
   (residual) probability/impact on the seeded 5×5 scales.
   **Expected**: inherent and residual **score and level are derived and displayed by the platform**;
   no field lets you type a level directly (FR-062).
2. Submit a factor value outside the configured scale (e.g. `6` on a 5-point scale) through the API.
   **Expected**: `400` with a clear validation message; nothing stored.
3. Reassess with different values. **Expected**: a **new** assessment record; the previous one remains
   retrievable and unchanged (SC-007).
4. Reassess a third time with values producing the *same* level. **Expected**: still stored as a
   distinct assessment.
5. Open the assessment history. **Expected**: each entry shows assessor, date, factor values, derived
   inherent and residual levels, and the change relative to the previous entry.
6. As administrator, publish a new methodology version, then reopen the historical assessments.
   **Expected**: stored results are unchanged and each remains interpretable under the methodology
   version in force when it was performed (FR-068).
7. Confirm the detail view presents inherent and residual as clearly distinct values with their
   relationship explained (FR-069).

### Scenario 5 — Define and track risk treatment (US5)

**Proves**: SC-005 · **Sign in as**: `manager@example.local` (holds `risk:treat`)

1. On an assessed risk, record a treatment strategy (mitigate / avoid / transfer-share / accept) with
   rationale and a deadline. **Expected**: strategy, rationale, deadline, deciding user and timestamp
   stored and audited.
2. Change the strategy. **Expected**: a new decision record; the superseded decision remains visible in
   history rather than being overwritten.
3. Associate two controls, then remove one. **Expected**: associations are listed where they influence
   residual risk; the removal is audited and visible in history; the risk remains valid.
4. Add treatment actions with a responsible user, due date and status, then change an action's status.
   **Expected**: the change is attributed and audited.
5. Set an action's due date in the past and leave it incomplete. **Expected**: the overdue condition
   appears on the risk detail, in the register, and in the dashboard's overdue-actions area.

### Scenario 6 — Govern the risk lifecycle (US6)

**Proves**: SC-008, SC-016, SC-005 · **Sign in as**: `analyst@example.local`, then `approver@example.local`

The authoritative transition table is in
[ADR-006](./research.md#adr-006-risk-calculation-and-lifecycle-owned-by-the-domain).

1. Walk a risk `DRAFT → IDENTIFIED → ASSESSED → UNDER_TREATMENT → UNDER_REVIEW`. **Expected**: at each
   step the interface offers only transitions valid from the current state *and* permitted to you.
2. Attempt `DRAFT → CLOSED` directly through the API. **Expected**: refused by the server; the risk
   remains in `DRAFT` (SC-008).
3. Attempt `IDENTIFIED → ASSESSED` on a risk with no assessment. **Expected**: refused with an
   explanation of the missing precondition.
4. Request acceptance as `analyst@example.local`. **Expected**: an explicit **pending-approval
   condition** on the risk; the lifecycle state does **not** change (FR-029c).
5. As the same requester, attempt to approve your own request. **Expected**: refused by the server on
   segregation-of-duties grounds; state unchanged (SC-016).
6. As `approver@example.local`, open the dashboard. **Expected**: the item appears in the
   pending-approvals area. Reject it with a justification. **Expected**: the risk returns to its prior
   state and the rejection is recorded with actor, timestamp and justification.
7. Request acceptance again and approve it as `approver@example.local`. **Expected**: the transition
   applies; the approval is retrievable with requester, approver, outcome and timestamp (SC-016).
8. Take the risk to `CLOSED` (also approval-gated) and attempt to edit its business content.
   **Expected**: the edit is refused; the record remains readable.
9. Concurrency: issue two different transition requests on the same risk simultaneously (two
   terminals). **Expected**: exactly one applies; the other is refused with the current state reported.

### Scenario 7 — Trace how a risk evolved (US7)

**Proves**: SC-009, SC-005 · **Sign in as**: `auditor@example.local` (Auditor, global scope)

1. Open a risk that has been created, edited, reassigned, assessed twice, treated and transitioned.
2. Open **History**. **Expected**: a single chronological, attributed account of assessments and level
   changes, ownership changes, treatment decisions, approvals and status changes — reconstructable in
   under 2 minutes with no database access (SC-009).
3. Open **Audit**. **Expected**: entries showing actor, timestamp, action, entity type, entity
   identifier and the relevant previous and new values (SC-005).
4. Sign in as `analyst@example.local` and open the same risk. **Expected**: the Audit section is not
   offered, and requesting the audit endpoint directly returns `403`.
5. Confirm no interface anywhere offers editing or deleting an audit entry. The database-level proof is
   in section 6.

### Scenario 8 — Administer access (US8)

**Proves**: SC-006, SC-015, SC-005 · **Sign in as**: the administrator

1. Create a user, assign `Risk Analyst` and a scope of `OU-A`. Sign in as that user.
   **Expected**: exactly the granted actions succeed; every other action is refused by the server.
2. While that user is signed in, remove `risk:edit` from their role. Without signing out, have them
   attempt an edit. **Expected**: refused on the very next request (FR-028) — no re-authentication
   required.
3. Deactivate the user. **Expected**: their sessions are revoked immediately and they can no longer
   authenticate.
4. Reparent `OU-A` under a new unit. **Expected**: the change is audited and scope resolution reflects
   the new structure — a grant on an ancestor now covers `OU-A`'s risks.
5. Move a risk from `OU-A` to `OU-B`. **Expected**: it immediately disappears from an `OU-A`-scoped
   user's register and is no longer retrievable by them (SC-015).
6. As `manager@example.local` (non-administrator), call an administrative endpoint directly.
   **Expected**: `403` (SC-006).
7. Confirm every administrative change above produced an audit entry with previous and new values —
   including the role's previous and new permission sets.

### Scenario 9 — Collaborate and attach evidence (US9)

**Proves**: SC-005, SC-006 · **Sign in as**: `analyst@example.local`, then `outsider@example.local`

1. Add a comment to a risk. **Expected**: stored with author and timestamp and shown in the Comments
   section; a comment containing HTML or `<script>` renders as literal text, never as markup.
2. Upload a PDF within the size limit. **Expected**: stored and listed with original file name, size,
   type, uploader and timestamp.
3. Upload a file of a disallowed type (e.g. `.exe`), then one larger than `ATTACHMENT_MAX_SIZE_BYTES`.
   **Expected**: each refused with a clear message; nothing stored.
4. Upload two files with the same name, and one with an unsafe name (`..\..\evil.pdf`).
   **Expected**: both are stored without collision under generated storage keys; original names are
   preserved only as display metadata.
5. Download the attachment. **Expected**: it downloads rather than rendering, with
   `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
6. As `outsider@example.local`, request the attachment's content endpoint directly by id.
   **Expected**: refused — access is governed by the parent record (SC-006).
7. Remove the comment and the attachment. **Expected**: both removals are audited with actor and
   timestamp, and attribution is preserved rather than hard-deleted.

### Extensibility check (SC-011)

Not a user story, but a release gate. Walk a stub module through the extension points and confirm none
of them requires editing the shell, `core/`, or Risk Management:

1. Add one navigation registry entry and confirm it appears in the sidebar, gated by its own
   permission, with no change to shell components.
2. Contribute one dashboard card and confirm it renders alongside the existing areas.
3. Seed one permission row for the stub resource and confirm the `PermissionGuard` enforces it with no
   schema change.
4. Attach a comment and an attachment to a stub entity type and confirm both capabilities work
   unchanged, with access still governed by the parent record.
5. Emit one audit event for the stub entity and confirm it is queryable through the same audit API.

**Expected**: the diff touches only the new module directory plus one registry entry and one seed row.

---

## 5. Automated verification

Run from the repository root. Layers and their mandatory coverage come from the plan's
[testing strategy](./plan.md#testing-strategy) — each is a release gate, not an aspiration.

```powershell
# Static gates
pnpm lint                 # includes the core/ vs modules/ import boundary rules (ADR-011)
pnpm typecheck            # TypeScript strict across every workspace package
pnpm openapi:check        # fails if the committed openapi.json is stale against the decorators
```

```powershell
# Unit — pure domain, no I/O, no NestJS container
pnpm --filter ./apps/api test:unit
```

Must prove: risk scoring across **every** matrix cell and both sides of every band boundary; the
lifecycle transition table including every invalid pair; the SoD rule (approver ≠ requester); the
password policy; organizational scope-set resolution.

```powershell
# Integration — real PostgreSQL and Redis
docker compose -f docker-compose.test.yml up -d
pnpm --filter ./apps/api test:integration
docker compose -f docker-compose.test.yml down -v
```

Must prove: an audit row is written in the same transaction as every audited change and is **absent**
when that transaction rolls back; assessment history survives repeated reassessment; an
optimistic-locking conflict returns `409` rather than last-write-wins; direct `UPDATE`/`DELETE` on
`audit_event` is rejected by the database.

```powershell
# Contract — HTTP surface via supertest
pnpm --filter ./apps/api test:contract
```

Must prove: every endpoint rejects unauthenticated calls; every endpoint rejects a caller lacking the
required permission; every risk endpoint rejects out-of-scope organizational access; every error
response conforms to `application/problem+json` and leaks nothing. These run with the frontend bypassed
entirely (SC-006, SC-015). Endpoint shapes are in [contracts/](./contracts/).

```powershell
# E2E — Playwright. Locally this runs against the dev servers from section 2 (playwright.config.ts's
# own `webServer` starts/reuses `pnpm dev` for the web app; point the API dev server at the database
# you want exercised). Docker Compose is a documented alternative (`PLAYWRIGHT_SKIP_WEB_SERVER=true`,
# what CI uses), not a requirement — and does not currently work end to end locally (F-12/F-13 above).
pnpm --filter ./apps/web exec playwright install --with-deps   # first run only

# playwright.config.ts reads these directly from the process environment, not from apps/web/.env —
# set them in the current shell before running the suite (verified: omitting them fails config
# loading outright, before a single test runs).
$env:APP_ORIGIN = "http://localhost:3000"
$env:API_INTERNAL_URL = "http://localhost:3001"
$env:SEED_ADMIN_EMAIL = "admin@example.com"             # Deve corresponder ao seed da API em execução.
$env:SEED_ADMIN_PASSWORD = "<the same password you seeded with>"

pnpm --filter ./apps/web test:e2e
pnpm --filter ./apps/web exec playwright show-report           # on failure
```

Must prove the critical journey: sign in → dashboard → create risk → assess → treat → request
acceptance → a second user approves → history and audit reflect it; plus session expiry and sign-out
revocation.

The suite runs at `workers: 4` (`apps/web/e2e/support/admin-session.ts`'s `E2E_WORKER_ADMIN_POOL_SIZE`,
which `playwright.config.ts` pins `workers` to) — F-16 (`docs/deferred-findings.md`) root-caused the
suite's old inability to run with more than one worker to almost every spec sharing one seeded
account whose password a helper permanently rotates, not to load; a pool of per-worker accounts
fixes it. **WebKit cannot sign in on Windows** (F-4): `fill()` on the login form's e-mail field does
not take, reproduced on the untouched `auth.spec.ts` in isolation, blocking every WebKit spec at
sign-in. This is environmental, not a product defect, and is not fixed here.

```powershell
# Everything, as CI runs it
pnpm test
```

SC-014 is met only when all of the above pass together.

---

## 6. Security spot-checks

Manual reviewer checks. The API is reached through `http://localhost:3000/api/v1` (ADR-014) and the
session rides in an httpOnly cookie (ADR-002), so a cookie-holding web session is required.

Establish a session once and reuse it:

```powershell
$origin = "http://localhost:3000"
$login = Invoke-WebRequest -Uri "$origin/api/v1/auth/login" -Method POST `
  -ContentType "application/json" -Headers @{ Origin = $origin } `
  -Body (@{ email = "analyst@example.local"; password = $env:VALIDATION_PASSWORD } | ConvertTo-Json) `
  -SessionVariable sess
$login.Headers['Set-Cookie']    # inspect the cookie attributes here
```

**1. Session cookie attributes.** Inspect the `Set-Cookie` header above, or DevTools → Application →
Cookies. **Expected**: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` whenever
`SESSION_COOKIE_SECURE=true`. In the browser console, `document.cookie` must **not** contain the
session cookie. The value must be opaque — no JWT, nothing decodable.

**2. Missing permission.** With a `readonly@example.local` session, edit a risk that user can see:

```powershell
Invoke-WebRequest -Uri "$origin/api/v1/risks/$riskId" -Method PATCH -WebSession $sess `
  -ContentType "application/json" -Headers @{ Origin = $origin } `
  -Body '{"title":"unauthorized change"}' -SkipHttpErrorCheck
```

**Expected**: `403` with `application/problem+json`; the record unchanged. The same call without a
session returns `401`.

**3. Out-of-scope risk.** With an `outsider@example.local` session, `GET /api/v1/risks/{id}` for an
`OU-A` risk. **Expected**: `404`, **not** `403` — existence must not be disclosed (FR-030). The same
risk must be absent from that user's register response and from its `total`.

**4. Attachment without parent access.** With the same out-of-scope session:
`GET /api/v1/attachments/{id}/content`. **Expected**: refused. A successful download by an authorized
user must carry `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` and a restrictive
`Content-Security-Policy`, so nothing executes in the browser.

**5. Error responses leak nothing.** Trigger a validation failure, an authorization failure and a
malformed-id request. **Expected**: every body is problem+json with `type`, `title`, `status`,
`detail`, `instance` and `correlationId` — and **no** stack trace, SQL fragment, Prisma error code,
internal identifier or file path (SC-010). Cross-check the API terminal: no password, session token,
cookie or authorization header appears in any log line.

**6. CSRF defense.** Repeat a state-changing request with the `Origin` header removed, or set to
`http://evil.example`. **Expected**: `403`.

**7. Audit is append-only at the database.** Using the **application** role from `DATABASE_URL`, not
the owner:

```powershell
docker compose exec postgres psql -U vertice_app -d vertice_grc -c "UPDATE audit_event SET action = 'tampered' WHERE id = (SELECT id FROM audit_event LIMIT 1);"
docker compose exec postgres psql -U vertice_app -d vertice_grc -c "DELETE FROM audit_event WHERE id = (SELECT id FROM audit_event LIMIT 1);"
```

**Expected**: both fail — permission denied from the revoked privilege, or an exception raised by the
`BEFORE UPDATE OR DELETE` trigger (FR-034,
[ADR-005](./research.md#adr-005-transactional-append-only-audit)). `INSERT` and `SELECT` still succeed;
zero rows change.

---

## 7. Performance validation (SC-004, SC-001)

Seed 50,000 risks spread across the organizational tree, with assessments so levels and review dates
are realistic. Run this against a **throwaway or test database, never `vertice_grc`** — it is not
reversible enough to risk on a database anyone is using (see
[`apps/api/prisma/seed/performance.seed.ts`](../../apps/api/prisma/seed/performance.seed.ts)'s own
header, and F-20 in `docs/deferred-findings.md`, for why):

```powershell
pnpm --filter ./apps/api run db:seed:performance -- --count=50000
```

This takes well under a minute in practice (measured: ~25s for 50,000 risks); it batches inserts and
reuses the seeded methodology version. There is no `--org-units` flag — the fixture always spreads
risk across a fixed tree of 21 organizational units of its own (`PERF-OU-ROOT` plus 20 children). Pass
`--reset` to remove every row the fixture created; pass `--count=<n>` for a smaller run. **Real command
verified directly** — the `--risks`/`--org-units` flags this section previously named do not exist on
this script and were never accepted by it.

The fixture's own organizational tree and users have no login credentials and are not in scope for any
manually-provisioned user (`manager@example.local`'s `OU-A` grant does **not** cover `PERF-OU-*` — they
are unrelated trees). **Authenticate as the seeded bootstrap administrator instead** (`SEED_ADMIN_EMAIL`
/ `SEED_ADMIN_PASSWORD`, `GLOBAL` scope) using the session pattern from section 6, then measure the
register, a risk detail, and the dashboard across representative combinations. Query parameter names
below are the real ones accepted by `ListRisksQueryDto` — `q` for search, `riskLevel` for the level
filter (residual by default; see `riskLevelBasis`), and `sort`/`direction` as two separate parameters,
never a single `field:direction` string:

```powershell
$cases = @(
  "/api/v1/risks?page=1&pageSize=50",
  "/api/v1/risks?page=1&pageSize=50&status=UNDER_TREATMENT&riskLevel=HIGH",
  "/api/v1/risks?page=1&pageSize=50&sort=riskLevel&direction=desc",
  "/api/v1/risks?page=1&pageSize=50&q=supplier",
  "/api/v1/risks?page=20&pageSize=50&sort=nextReviewOn&direction=asc"
)
foreach ($case in $cases) {
  $ms = 1..50 | ForEach-Object {
    (Measure-Command { Invoke-WebRequest -Uri "$origin$case" -WebSession $sess -UseBasicParsing }).TotalMilliseconds
  } | Sort-Object
  "{0,-64} p50={1,6:N0}ms p95={2,6:N0}ms" -f $case, $ms[24], $ms[47]
}

# Risk detail overview — substitute a real id, e.g. from the register response above.
$riskId = "<a-real-perf-risk-id>"
$ms = 1..50 | ForEach-Object {
  (Measure-Command { Invoke-WebRequest -Uri "$origin/api/v1/risks/$riskId" -WebSession $sess -UseBasicParsing }).TotalMilliseconds
} | Sort-Object
"risk detail overview p50={0,6:N0}ms p95={1,6:N0}ms" -f $ms[24], $ms[47]

# Dashboard aggregate.
$ms = 1..50 | ForEach-Object {
  (Measure-Command { Invoke-WebRequest -Uri "$origin/api/v1/dashboard" -WebSession $sess -UseBasicParsing }).TotalMilliseconds
} | Sort-Object
"dashboard aggregate      p50={0,6:N0}ms p95={1,6:N0}ms" -f $ms[24], $ms[47]
```

The default per-client rate limit (`THROTTLE_LIMIT`, 100 requests per `THROTTLE_TTL_SECONDS`) will
return `429`s partway through a 50-sample loop; raise `THROTTLE_LIMIT` for the API process while
measuring (it is a deliberate product control, not something to tune around silently — restore it
afterward).

**Pass criteria** (plan, Performance Goals):

| Measure | Budget |
|---------|--------|
| Register API p95, any filter/sort/search combination | ≤ 400 ms |
| Register end-to-end render in the browser | ≤ 2 s (SC-004) |
| Risk detail overview API p95 | ≤ 250 ms |
| Dashboard aggregate API p95 | ≤ 600 ms |
| Sign-in to dashboard visible, as a real browser experiences it | ≤ 10 s (SC-001) |

Also confirm no endpoint returns an unbounded set — a `pageSize` above the cap is rejected or clamped —
and that the register does not attempt to render every matching row. If a case misses its budget, check
the query plan against the indexes in
[data-model.md section 8](./data-model.md#8-risk-management--the-risk-record); a missing index, not a
code path, is the usual cause.

---

## 8. Troubleshooting

**Docker is not running.** `docker version` reports the daemon is unreachable, or `docker compose up`
fails immediately. Start Docker Desktop and wait for it to settle before retrying.

**Port already in use.** `5432`, `6379`, `3000` or `3001` is taken — commonly by a locally installed
PostgreSQL service or a previous `pnpm dev` that did not exit.

```powershell
Get-NetTCPConnection -LocalPort 5432,6379,3000,3001 -State Listen |
  Select-Object LocalPort, OwningProcess, @{n='Process';e={(Get-Process -Id $_.OwningProcess).ProcessName}}
```

Stop the offending process, or remap the host port in `docker-compose.yml` and `.env` — then update
`DATABASE_URL`, `REDIS_URL`, `API_PORT`, `WEB_PORT`, `API_INTERNAL_URL` and `APP_ORIGIN` to match.

**Migration drift.** `prisma migrate deploy` or `migrate status` reports the schema does not match the
migration history — usually after switching branches. Diagnose, then reset a **development** database
only:

```powershell
pnpm --filter ./apps/api exec prisma migrate status
pnpm --filter ./apps/api exec prisma migrate reset      # DESTRUCTIVE — dev only, re-runs seed
```

Never run `migrate reset` against anything holding real data. Migrations are forward-only
([data-model.md section 14](./data-model.md#14-migration-and-seed-policy)).

**Seed already applied.** `prisma db seed` fails on a unique constraint (permission identifier, role
name, org unit code or the admin email). The seed is intended to be idempotent, so a constraint failure
means seed data was modified by hand. Re-run against a clean database (`migrate reset`) rather than
deleting rows.

**Seed refuses to run.** `SEED_ADMIN_PASSWORD` is unset or fails the password policy. Set it in the
current shell (`$env:SEED_ADMIN_PASSWORD = "..."`) — not in a committed file — and retry.

**`/health/ready` reports unhealthy.** PostgreSQL or Redis is not accepting connections yet, or the
credentials in `.env` do not match `docker-compose.yml`. `docker compose ps` must show both healthy;
`docker compose logs postgres redis` shows why not.

**`/api/*` returns the Next.js 404 page.** The rewrite is not in effect: `API_INTERNAL_URL` is wrong or
the API is not listening. Confirm `http://localhost:3001/api/v1/health/live` responds, then restart the
web dev server — rewrite configuration is read at startup.

**Signed in but every request is `401`.** A cookie marked `Secure` is never sent over plain HTTP.
Confirm `SESSION_COOKIE_SECURE=false` for local HTTP development, and browse `http://localhost:3000`
rather than `127.0.0.1` — cookies are host-specific, and `APP_ORIGIN` must match the host you use or
the CSRF origin check will reject writes as well.

**`argon2` fails to install or load.** The native build was skipped. Run `pnpm approve-builds`, then
`pnpm install --force`. Ensure Node is 22 LTS x64.

**Playwright cannot reach the app.** The e2e suite targets the Docker Compose stack. Make sure
`docker compose up -d --build` finished and that migrations and the seed were applied **inside the
container**, not only on the host.
