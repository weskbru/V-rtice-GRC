# Implementation Plan: GRC Platform Foundation and Risk Management

**Branch**: `001-grc-platform-foundation` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-grc-platform-foundation/spec.md`

## Summary

Deliver the Vértice GRC platform foundation — provider-agnostic identity, explicit sessions, granular
RBAC with enforced organizational scope, a centralized append-only audit trail, reusable
files/comments/notifications capabilities, and an extensible application shell with a GRC dashboard —
plus Risk Management as the first complete business domain, covering the risk register, configurable
methodology-driven assessment with preserved history, treatment with risk-owned actions, an explicit
approval-gated lifecycle, and full traceability.

The system is built as a **modular monolith**: one NestJS API process with hard internal boundaries
between platform core capabilities and business domains, and one Next.js App Router frontend built on
a Vértice GRC Design System layered over shadcn/ui. PostgreSQL with Prisma is the system of record;
Redis serves only cache, rate limiting and hot session lookup. All authorization and all risk
calculation are server-side and centralized. Historical GRC information is preserved through immutable
append-only domain records (assessments, treatment decisions, lifecycle transitions, approvals) plus a
tamper-resistant audit table written in the same transaction as the change it records.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS (both applications)

**Primary Dependencies**:

- *Backend*: NestJS 11, Prisma 6, `@nestjs/swagger` (OpenAPI 3.1), `class-validator` /
  `class-transformer`, `argon2` (password hashing), `pino` (structured logging), `ioredis`,
  `helmet`, `@nestjs/throttler` (rate limiting)
- *Frontend*: Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui on Radix UI primitives,
  Lucide React, TanStack Table 8, TanStack Query 5, Recharts 2, `react-hook-form` + `zod`
- *Explicitly excluded*: Material UI, Ant Design, Chakra UI, Bootstrap; any second component library

**Storage**: PostgreSQL 17 (system of record, all GRC and audit data) · Redis 7 (cache, rate limit
counters, session lookup cache — never authoritative) · Local disk via a storage port for attachments
in this release, S3-compatible object storage behind the same port later

**Database roles**: two, because ADR-005 revokes `UPDATE`/`DELETE` on `audit_event` from the
application while migrations still need ownership — a restricted application role (`DATABASE_URL`)
and an owner/migration role (`DATABASE_MIGRATION_URL`). The application must never run with the owner
role, or the append-only guarantee is only a convention.

**Testing**: Vitest (domain unit tests, application integration tests against a real PostgreSQL) ·
Playwright (end-to-end journeys against the Docker Compose stack) · `supertest` for HTTP contract
tests

**Target Platform**: Linux containers, served behind a single origin. Modern desktop browsers for the
frontend; usable but not optimized on small screens.

**UI Language**: All v1 user-facing interface text is Brazilian Portuguese (pt-BR), centralized in
`apps/web/src/lib/messages/` and `apps/api/src/shared/messages/user-messages.ts`; technical
identifiers (code, types, database, API, audit action names, logs) remain in English (Constitution
X).

**Project Type**: Web application — pnpm monorepo with a NestJS API and a Next.js frontend

**Performance Goals**:

- Risk register page (50 rows, any filter/sort/search combination) — API p95 ≤ 400 ms with 50,000
  risks present; end-to-end render ≤ 2 s (SC-004)
- Risk detail (overview tab) — API p95 ≤ 250 ms
- Dashboard aggregate payload — API p95 ≤ 600 ms
- Authentication → dashboard visible ≤ 10 s on a corporate connection (SC-001)

**Constraints**:

- Every read and write of a risk is filtered by the acting user's organizational scope (FR-025)
- No unbounded result sets on any endpoint (FR-086); max page size capped
- Audit entries are append-only and enforced at the database level (FR-034)
- No secret, credential, session identifier, stack trace or internal identifier in any client
  response, log or audit entry (FR-107, FR-108, SC-010)
- Session revocation takes effect on the next request, so bearer-style self-contained tokens are
  excluded (FR-015, FR-017)
- No microservices, no message broker, no event-driven architecture in this release

**Scale/Scope**: Single deployment per organization. Designed for ~50,000 risks, ~1,000
organizational units, ~5,000 users and millions of audit entries. Roughly 20 screens: login,
dashboard, risk register, risk detail (10 sections), risk create/edit, profile, and administration for
users, roles and organizational units.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0.

| # | Principle | Gate | Status | How the design satisfies it |
|---|-----------|------|--------|------------------------------|
| I | GRC Domain Integrity | No generic/EAV modeling of GRC concepts; domains bounded; relationships explicit; new module needs no core change | **PASS** | Explicit tables per concept; causes/consequences as rows not blobs; `RiskControlLink` as a named relation (ADR-008); `core/` vs `modules/` separation with lint-enforced import rules (ADR-011) |
| II | Security by Design | Server-side authn/authz on every request; provider-agnostic identity; no secrets in code; OWASP controls | **PASS** | Global auth guard with explicit `@Public()` opt-out; `AuthenticationProvider` port (ADR-001); argon2id; helmet, throttler, CSRF origin checks (ADR-002) |
| III | Identity, Access Control, SoD | Users/roles/permissions/org scope; granular actions; centralized decisions; SoD enforced in domain | **PASS** | `PermissionGuard` + `ScopeResolver` as the single decision path (ADR-003, ADR-004); approver ≠ requester enforced in the risk domain, not the controller (ADR-006) |
| IV | Auditability and Traceability | Audit centralized, append-only, complete fields, reusable | **PASS** | `AuditRecorder` written inside the same transaction as the change; `UPDATE`/`DELETE` revoked and trigger-blocked on `audit_event` (ADR-005) |
| V | Data Integrity and Governance | DB constraints, referential integrity, no hard delete of historical records, explicit lifecycle/ownership | **PASS** | FK + `NOT NULL` + `CHECK` + unique constraints throughout; archived state instead of deletion; optimistic locking for concurrent edits (ADR-013) |
| VI | Risk Management Integrity | Inherent/residual/treatment/assessment supported; history preserved; calculation centralized and versioned | **PASS** | `RiskScoringService` is the only calculator; `RiskAssessment` rows immutable and pinned to a `RiskMethodologyVersion` (ADR-006, ADR-007) |
| VII | Workflow and Accountability | Explicit states/transitions/responsibility/approvals; no implicit transitions; actions attributable | **PASS** | Declarative transition table in the risk domain; every transition writes a `RiskLifecycleTransition` row with actor (ADR-006) |
| VIII | Code Quality and Architecture | Strict TypeScript; modular, cohesive, loosely coupled; domain separated from infrastructure; no premature abstraction | **PASS** | `strict` + `noUncheckedIndexedAccess`; four layers per module; no queue, no broker, no CQRS, no event sourcing in this release (ADR-015) |
| IX | Testing Standards | Business-critical functionality tested; dedicated tests for security, authz, risk calc, workflow, audit | **PASS** | Test strategy in plan §Testing Strategy; scoring boundary tests, negative authorization tests and audit-emission tests are mandatory gates |
| X | UX Consistency | One design system; consistent patterns; new modules without shell change; accessible | **PASS** | Vértice GRC Design System package with tokens and domain components; shell driven by a navigation registry (ADR-011); all user-facing text is pt-BR per centralized message catalogs, technical identifiers stay in English |
| XI | Performance and Scalability | Declared targets; no N+1; no unbounded sets; indexes, pagination, caching justified | **PASS** | Targets above; every register filter/sort column indexed; offset pagination with capped page size (ADR-009); Redis only where measured need exists |
| XII | Observability and Operational Reliability | Structured logs, categorized events, no sensitive data, health checks | **PASS** | pino with request correlation id; four log categories distinct from audit; `/health` liveness and readiness (ADR-012 in research) |
| XIII | API and Integration Standards | Explicit contracts, validation, consistent errors, versioning, isolated integrations | **PASS** | `/api/v1`, DTOs never expose Prisma models, RFC 9457 problem+json, OpenAPI generated from decorators (ADR-009); directory sync is an infrastructure adapter (ADR-001) |
| XIV | Documentation and Architectural Decisions | Decisions documented with context, alternatives, consequences | **PASS** | 15 ADRs in [research.md](./research.md), each with rationale, alternatives and trade-offs |
| XV | Change Management and Backward Compatibility | Incremental, reversible; explicit migrations; no breaking changes without approval; history preserved | **PASS** | Prisma migrations only, reviewed; additive-first policy; methodology versioning prevents retroactive rescoring (ADR-007) |
| XVI | Compliance-Oriented Engineering | Evidence, accountability, traceability, approvals, reporting supported; no hard-coded exceptions | **PASS** | Approvals are first-class records; no override or emergency-access path exists in this release |

**Gate result: PASS.** No principle requires a waiver. Two deliberate complexity additions are
recorded in [Complexity Tracking](#complexity-tracking) with their justification.

### Post-Design Re-Check (after Phase 1)

Re-evaluated on 2026-09-04 against the completed [data-model.md](./data-model.md),
[contracts/](./contracts/) (78 operations across four documents) and [quickstart.md](./quickstart.md).

**Result: PASS**, with four corrections applied during review rather than carried forward:

| Finding | Principle at risk | Correction applied |
|---------|-------------------|--------------------|
| ADR-006 assigned `risk:approve` to the *request* side of approval-gated transitions, so every user able to propose acceptance would already hold the permission to grant it — leaving `approver ≠ requester` as the only remaining control | **III** (segregation of duties), FR-029a | Requesting now requires `risk:transition`, deciding requires `risk:approve`. ADR-006, data-model.md and T157 updated |
| `risk:delete` was seeded but governed nothing, since FR-102 forbids hard deletion and archival is gated by `risk:administer` | **XVI** (no undocumented or meaningless compliance surface), **X** (administrators must not be shown capabilities that do not exist) | Removed from the seeded set. `PermissionAction.DELETE` remains as FR-022 requires, exercised by `attachment:delete` and `comment:delete` |
| "Risk level" was unqualified in FR-088/FR-091 while the model stores both inherent and residual | **I** (one concept, one name), **VI** | Explicit `riskLevelBasis` parameter defaulting to `RESIDUAL`, recorded in ADR-006 and T105 |
| The methodology-change-mid-assessment edge case had no decided rule | **VI** (no silent rescoring), **XV** | Submission names its `methodologyVersionId` and is refused with `422` if superseded. No grace window. Recorded in ADR-007 and T124 |

Design-stage confirmations:

- **Principle IV** — every audited operation in the contracts writes through `AuditRecorder` inside the
  change's transaction; `audit_event` carries no update or delete path in any of the 78 operations.
- **Principle VI** — derived scores and levels appear only in response schemas, all `readOnly: true`;
  every write DTO is `additionalProperties: false`, so a client supplying a score is rejected at the
  boundary rather than trusted.
- **Principle XIII** — no Prisma model is exposed; `DELETE /risks/{id}` does not exist anywhere in the
  contracts, archival being a lifecycle transition.
- **Principle V** — optimistic locking is expressed as `ETag`/`If-Match` on every risk mutation
  including sub-resources and transitions, so last-write-wins is unreachable through the API.

Two items are recorded as **spec gaps to resolve before or during implementation**, not as design
defects: reference data (categories, types, origins and the control/process/asset registries) is
described as organization-configurable but no requirement asks for its maintenance, so it is exposed
read-only and seeded; and the dashboard's "action plans" area is backed by risk-owned treatment-action
counts, since the shared Action Plans module is out of scope. Both are additive to resolve.

## Project Structure

### Documentation (this feature)

```text
specs/001-grc-platform-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 — 15 architectural decisions with trade-offs
├── data-model.md        # Phase 1 — entities, relationships, constraints, indexes, state machine
├── quickstart.md        # Phase 1 — how to run and validate the system end to end
├── contracts/           # Phase 1 — OpenAPI contracts per capability
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 — created by /speckit-tasks, NOT by this command
```

### Source Code (repository root)

```text
vertice-grc/
├── apps/
│   ├── api/                                   # NestJS modular monolith
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/                    # explicit, reviewed, forward-only
│   │   │   └── seed/                          # roles, permissions, reference data, methodology
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── shared/                        # kernel: errors, result types, pagination, ids
│   │   │   ├── infrastructure/                # framework-facing, no business rules
│   │   │   │   ├── prisma/                    # PrismaService, transaction manager
│   │   │   │   ├── redis/
│   │   │   │   ├── logging/                   # pino, request context (AsyncLocalStorage)
│   │   │   │   ├── config/                    # env schema validation
│   │   │   │   ├── http/                      # exception filter, interceptors, guards wiring
│   │   │   │   └── health/
│   │   │   ├── core/                          # platform capabilities — no dependency on modules/
│   │   │   │   ├── identity/                  # internal identity + authentication ports
│   │   │   │   │   ├── domain/
│   │   │   │   │   ├── application/
│   │   │   │   │   ├── infrastructure/providers/local/     # ldap/, oidc/, saml/ added later
│   │   │   │   │   └── presentation/
│   │   │   │   ├── users/
│   │   │   │   ├── sessions/
│   │   │   │   ├── authorization/             # permissions, roles, guards, ScopeResolver
│   │   │   │   ├── organizations/             # organizational unit tree
│   │   │   │   ├── audit/                     # AuditRecorder + query API
│   │   │   │   ├── files/                     # storage port + local adapter
│   │   │   │   ├── comments/
│   │   │   │   ├── notifications/
│   │   │   │   └── configuration/
│   │   │   └── modules/                       # business domains — may depend on core/, not on each other
│   │   │       └── risk/
│   │   │           ├── domain/                # entities, value objects, scoring, lifecycle rules
│   │   │           ├── application/           # use cases, transactional orchestration
│   │   │           ├── infrastructure/        # Prisma repositories, query services
│   │   │           └── presentation/          # controllers, DTOs, OpenAPI decorators
│   │   └── test/
│   │       ├── unit/                          # pure domain, no I/O
│   │       ├── integration/                   # real PostgreSQL + Redis
│   │       └── contract/                      # HTTP contract assertions
│   └── web/                                   # Next.js App Router
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/login/
│       │   │   └── (app)/                     # authenticated layout = the application shell
│       │   │       ├── dashboard/
│       │   │       ├── risks/                 # register, [id] detail with section routes, new
│       │   │       ├── admin/                 # users, roles, organizational units
│       │   │       └── profile/
│       │   ├── components/
│       │   │   ├── ui/                        # shadcn/ui generated primitives (unmodified)
│       │   │   └── shell/                     # sidebar, header, user menu, breadcrumbs
│       │   ├── features/                      # feature-scoped hooks, forms, tables
│       │   │   ├── auth/  ├── dashboard/  └── risks/
│       │   ├── lib/                           # api client, query client, permission helpers
│       │   └── styles/
│       └── e2e/                               # Playwright specs
├── packages/
│   ├── design-system/                         # Vértice GRC Design System: tokens + domain components
│   └── api-types/                             # types generated from the API's OpenAPI document
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── docker-compose.yml                         # postgres, redis, api, web
├── docker-compose.test.yml                    # isolated postgres/redis for integration + e2e
└── .env.example                               # every variable documented, no real values
```

**Structure Decision**: A pnpm workspace monorepo with two deployable applications (`apps/api`,
`apps/web`) and two shared packages. The backend is a single NestJS process — a modular monolith —
whose internal boundary between `core/` (platform capabilities) and `modules/` (business domains) is
enforced by lint rules rather than by process boundaries. Each module is internally layered
`domain → application → infrastructure → presentation`, with dependencies pointing inward only. Adding
a future GRC module means adding one directory under `modules/`, one navigation registry entry and one
dashboard card contribution; nothing in `core/`, the shell or Risk Management changes.

`packages/design-system` exists so that visual and interaction patterns are defined once and consumed
identically by every present and future module (Constitution X). `packages/api-types` is generated from
the API's own OpenAPI document, so the frontend cannot drift from the contract and no type is
hand-duplicated (Constitution VIII, XIII).

## Architectural Decisions

Fifteen decisions materially affect this system. Each is recorded in
[research.md](./research.md) with context, decision, rationale, alternatives considered, trade-offs
accepted and consequences.

| ADR | Area | Decision in one line |
|-----|------|----------------------|
| ADR-001 | Authentication | `AuthenticationProvider` port; local argon2id provider now; LDAP/AD/OIDC/SAML are infrastructure adapters plus a directory-sync integration, never business dependencies |
| ADR-002 | Sessions | Opaque server-side session identifier in an httpOnly/Secure/SameSite=Lax cookie; PostgreSQL is authoritative, Redis is a validation cache; no JWT |
| ADR-003 | Authorization | RBAC with `resource:action` permissions resolved by a single `PermissionGuard`; frontend checks are advisory only |
| ADR-004 | Organizational scope | Materialized path on the org tree; scope resolved to a unit-id set per request, cached in Redis, applied as a mandatory predicate in the repository layer |
| ADR-005 | Audit | Explicit `AuditRecorder` calls in the application layer inside the same transaction as the change; `audit_event` protected by revoked privileges and a trigger |
| ADR-006 | Risk calculation and lifecycle | `RiskScoringService` and a declarative transition table own all risk rules; the API returns derived values, the frontend never computes them |
| ADR-007 | Historical data | Append-only domain history tables (assessments, treatment decisions, transitions, approvals) plus methodology versioning; no temporal tables, no event sourcing |
| ADR-008 | Database modeling | Explicit tables and relations; PostgreSQL enums for closed platform sets, reference tables for organization-configurable sets; no EAV |
| ADR-009 | API contracts | `/api/v1`, hand-written DTOs, RFC 9457 `application/problem+json`, offset pagination with a capped page size, OpenAPI generated from decorators |
| ADR-010 | File storage | `FileStorageProvider` port with a local-disk adapter; attachments served only through an authorizing endpoint with hardened headers |
| ADR-011 | Module boundaries | `core/` never imports `modules/`; modules never import each other; enforced by `eslint-plugin-boundaries` in CI |
| ADR-012 | Observability | pino structured logs in four categories with a request correlation id, conceptually separate from audit; `/health/live` and `/health/ready` |
| ADR-013 | Concurrency | Optimistic locking via a `version` column on risks; conflicting writes return `409`, never last-write-wins |
| ADR-014 | Frontend/API topology | Single origin — Next.js rewrites `/api/*` to the API; cookies stay first-party; no token is ever readable by client JavaScript |
| ADR-015 | Asynchronous work | No queue in this release; overdue conditions are computed on read from indexed dates; the application-service layer is the documented seam for a future queue |

## Testing Strategy

Constitution IX requires dedicated tests for security, authorization, risk calculation, workflow and
auditability. The following are release gates, not aspirations.

| Layer | Tool | Scope | Mandatory coverage |
|-------|------|-------|--------------------|
| Unit | Vitest | Pure domain — no I/O, no NestJS container | Risk scoring across every matrix cell and both band boundaries; lifecycle transition table including every invalid transition; SoD rule (approver ≠ requester); password policy; scope-set resolution |
| Integration | Vitest + real PostgreSQL/Redis | Application services and repositories inside transactions | Audit row written in the same transaction as every audited change and absent when the transaction rolls back; assessment history preserved across reassessment; optimistic-locking conflict; append-only enforcement rejecting direct `UPDATE`/`DELETE` on `audit_event` |
| Contract | Vitest + supertest | HTTP surface | Every endpoint rejects unauthenticated calls; every endpoint rejects a caller lacking the permission; every risk endpoint rejects out-of-scope organizational access; error responses conform to problem+json and leak nothing |
| E2E | Playwright | Critical journeys against Docker Compose | Sign in → dashboard → create risk → assess → treat → request acceptance → second user approves → verify history and audit; session expiry; sign out revokes |

Negative authorization cases are written for every protected endpoint, exercised through the HTTP
layer with the frontend bypassed entirely (SC-006, SC-015). Test data volume for register performance
assertions is seeded to 50,000 risks (SC-004).

## Implementation Sequence

Incremental, each step independently reviewable, following the sequence approved in the input:

1. **Foundation** — monorepo, TypeScript strict config, lint with boundary rules, Docker Compose
   (PostgreSQL, Redis), environment schema validation, CI running lint + type-check + tests
2. **Backend skeleton** — NestJS bootstrap, Prisma, structured logging with request context, global
   exception filter, health checks, OpenAPI generation
3. **Design system and shell** — tokens, shadcn/ui baseline, Vértice GRC components, login screen,
   authenticated layout with sidebar/header/user menu driven by the navigation registry
4. **Identity and authentication** — internal user model, `AuthenticationProvider` port, local
   provider, password policy, rate limiting
5. **Sessions** — creation, expiry, revocation, cookie handling, CSRF defenses, session audit
6. **Users and profile** — user administration, own-profile view, password change
7. **Authorization** — permissions, roles, `PermissionGuard`, frontend permission hooks
8. **Organizations** — org unit tree, materialized path, `ScopeResolver`, global scope grants
9. **Audit** — `AuditRecorder`, append-only enforcement, audit query API and timeline component
10. **Reusable capabilities** — files/attachments port and local adapter, comments, in-app
    notifications
11. **Risk domain** — entities, methodology configuration, `RiskScoringService`, lifecycle table
12. **Risk register** — list query, filters, sort, search, pagination, TanStack Table register UI
13. **Risk assessment** — assessment capture, history preservation, matrix and score components
14. **Risk treatment** — strategies, decisions, risk-owned treatment actions, control links
15. **Risk lifecycle and approvals** — transitions, approval requests and decisions, SoD enforcement
16. **Risk history and audit views** — merged chronological history, audit tab
17. **Dashboard** — server-computed aggregates, Recharts visualizations, planned-module cards
18. **Hardening** — security headers, dependency audit, performance validation at target volume
19. **Test completion** — close every mandatory coverage gate above
20. **Review** — security review and architecture review against this plan and the constitution

## Complexity Tracking

No constitution violations require a waiver. Two deliberate additions beyond the simplest possible
approach are recorded here for review.

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| `packages/api-types` generated from OpenAPI | The frontend must consume API contracts without hand-copying types; drift between the two would be silent and would violate Constitution VIII (duplication) and XIII (explicit contracts) | Hand-written frontend types drift the moment a DTO changes and nothing detects it; a shared hand-maintained types package is the same duplication with extra ceremony |
| Materialized path on `organizational_unit` | Organizational scope is a predicate on *every* risk read (FR-025); resolving ancestry with a recursive CTE on each request puts tree traversal on the hottest path in the system | A recursive CTE per request is simpler but repeats tree work thousands of times per minute; a closure table is faster to reparent but adds a second table and more write complexity than a path column for a tree of ~1,000 nodes |

Explicitly **not** introduced, and why: microservices (no scale or organizational driver yet — the
modular monolith preserves the option), a message broker or event-driven architecture (no concrete
requirement in this release), CQRS or event sourcing (append-only domain history already satisfies the
traceability requirement at a fraction of the complexity), a job queue (nothing in this release runs
outside a request), and a generic entity-relationship mechanism (Constitution I requires explicit
relationships where the business meaning is known).
