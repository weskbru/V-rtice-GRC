# Phase 0 Research: Architectural Decisions

**Feature**: GRC Platform Foundation and Risk Management
**Date**: 2026-09-04
**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Constitution**: v1.0.0

The technology stack was approved in the planning input, so no stack selection remains open. This
document records the fifteen decisions that materially affect authentication, sessions, authorization,
organizational scope, audit, risk calculation, historical data, database modeling, API contracts, file
storage and module boundaries — each with its rationale, the alternatives considered, and the
trade-offs accepted.

**No `NEEDS CLARIFICATION` items remain.** The three open questions from the specification phase were
resolved with the user on 2026-09-04 and are recorded in the spec's Assumptions section.

---

## ADR-001: Provider-agnostic authentication

**Context**: FR-001 to FR-004 require an internal identity independent of the authentication
mechanism, with LDAP, Active Directory, OIDC and SAML addable later without touching Risk Management.
Constitution II mandates a provider-agnostic identity architecture.

**Decision**: Define an `AuthenticationProvider` port in `core/identity/domain`:

```
authenticate(credentials): Promise<AuthenticationResult>   // verified external subject, or failure
supports(method: AuthenticationMethod): boolean
```

`LocalAuthenticationProvider` (argon2id) is the only adapter in this release. Every provider returns a
*verified external subject* — a stable external identifier plus optional profile attributes — never a
session and never a platform user. A separate `IdentityResolver` maps a verified external subject to
the internal `User`, which is the only identity any business module ever sees. Directory
synchronization (importing users and group memberships from LDAP/AD) is modeled as a future
*integration adapter* in `core/identity/infrastructure`, not as a domain capability.

**Rationale**: Business modules depend on `User.id` and nothing else. Adding SAML means adding an
adapter and a route; the risk domain does not change, satisfying FR-004 by construction. Separating
"verify the subject" from "resolve the internal user" keeps just-in-time provisioning and directory
sync out of the authentication path.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Passport.js strategies as the abstraction | Passport's strategy contract leaks Express request/response shape into the domain and couples the platform to one HTTP framework, violating Constitution VIII |
| A generic `IdentityProvider` interface covering authentication *and* user synchronization | Conflates two concerns with different lifecycles — authentication is per-request, sync is scheduled — and would force a sync-shaped interface onto local authentication, which has nothing to sync |
| Delegate everything to an external IdP from day one | The input requires local authentication to be operational now; adding an IdP dependency to run the product is an operational burden with no current benefit |

**Trade-offs accepted**: One extra indirection between the login controller and password verification,
which is unused in this release. Justified because the alternative — retrofitting an abstraction across
an already-shipped authentication path — is exactly the breaking change Constitution XV forbids.

**Consequences**: Password hashing parameters (argon2id, memory 19 MiB, time cost 2, parallelism 1 as
a baseline) live in the local adapter and are configurable. The `User` table carries no password
column; local credentials live in a separate `LocalCredential` table so that adding federated users
does not create rows with meaningless null secrets.

---

## ADR-002: Server-side opaque sessions, not JWT

**Context**: FR-012 to FR-020 require identifiable sessions with recorded metadata, expiry, revocation,
and immediate effect when a user is deactivated or changes their password. FR-019 requires session
credentials unreadable by client scripts.

**Decision**: On successful authentication, generate a 256-bit random session identifier. Store the
session in PostgreSQL (`session` table: user, created, expires, last activity, IP, user agent,
authentication method, revoked-at). Send the identifier to the browser in a cookie marked `httpOnly`,
`Secure`, `SameSite=Lax`, `Path=/`. Mirror active sessions into Redis with a TTL as a *validation
cache only*; on a cache miss, fall back to PostgreSQL. Revocation deletes the Redis entry and stamps
`revokedAt` in PostgreSQL.

Sliding expiry updates `lastActivityAt` at most once per minute per session to avoid a write on every
request. Absolute lifetime is enforced independently of activity.

**Rationale**: Revocation is the requirement that decides this. FR-017 requires all of a user's
sessions to stop working the moment they are deactivated; a self-contained token cannot be withdrawn
before it expires without maintaining a denylist — which is a server-side session store with extra
steps. PostgreSQL is authoritative because sessions are audit evidence (FR-018) and because FR-020
requires them to remain queryable for future user-facing session management; Redis exists purely to
keep per-request validation off the primary database.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| JWT access token + refresh token | Revocation is not possible within the access token's lifetime without a denylist; shortening the lifetime to compensate trades correctness for request volume. Also invites storing the token in JS-reachable storage, violating FR-019 |
| Redis as the authoritative session store | Constitution and the input both forbid Redis as a system of record; a Redis eviction or restart would silently sign out every user and destroy session audit evidence |
| Stateless signed cookie carrying user and permissions | Permission changes would not take effect until the cookie is reissued, violating FR-028 |

**Trade-offs accepted**: One cache lookup (and rarely one database read) per authenticated request,
versus signature verification for a JWT. At the target scale this is well within the performance
budget, and it buys immediate revocation, complete session metadata and auditability.

**Consequences**: CSRF defense is required because authentication rides on a cookie. `SameSite=Lax`
blocks cross-site form posts; in addition, every state-changing request validates that `Origin` (or
`Referer`) matches the deployment origin, and is rejected with `403` otherwise. Session fixation is
prevented by issuing a fresh identifier on every successful authentication.

---

## ADR-003: RBAC with `resource:action` permissions and one decision path

**Context**: FR-021 to FR-030 require users, roles, permissions and organizational scope, with at
minimum view, create, edit, delete, approve and administer; all decisions server-side and centralized.
Constitution III forbids scattered inline permission logic.

**Decision**: Permissions are stable string identifiers of the form `resource:action` —
`risk:view`, `risk:create`, `risk:edit`, `risk:approve`, `risk:assess`, `risk:treat`,
`risk:transition`, `risk:administer`, `audit:view`, `user:administer`, `role:administer`,
`org_unit:administer`, `methodology:administer`, `attachment:create`, `attachment:delete`,
`comment:create`, `comment:delete`. Roles are named permission sets; users hold roles.
No `risk:delete` is seeded — FR-102 forbids hard-deleting a risk, so the identifier would grant nothing;
`PermissionAction.DELETE` is exercised by the attachment and comment permissions instead.
Permission rows are seeded and referenced by identifier so that a permission can be renamed only by an
explicit migration.

A single `@RequirePermission('risk:edit')` decorator plus a global `PermissionGuard` is the only place
a permission is checked on the server. The guard resolves the caller's effective permission set (union
over roles), cached in Redis keyed by `userId:permissionsVersion`; any role or assignment change
increments `permissionsVersion`, so FR-028 is satisfied without waiting for a TTL.

Frontend permission checks exist solely to hide or disable controls. They are documented as
non-security and every protected endpoint has a contract test that calls it directly without the
permission.

**Rationale**: One decorator and one guard make the authorization surface auditable by reading a single
file plus a grep for the decorator. String identifiers keep the permission set extensible by future
modules without a schema change (a new module seeds its own permission rows).

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Boolean `isAdmin` plus ad-hoc checks | Explicitly prohibited by Constitution III and FR-021 |
| Full ABAC/policy engine (Casbin, OPA) now | Premature abstraction (Constitution VIII): the current requirements are role plus organizational scope, and a policy engine adds a language, a deployment artifact and a debugging surface for no present benefit |
| Permissions as a bitmask | Compact but opaque; renders audit entries and administration screens unreadable, and caps extensibility at the word size |

**Trade-offs accepted**: `resource:action` strings are not type-checked by the database. Mitigated by
generating a TypeScript union of permission identifiers from the seed definition, so a typo in a
decorator fails type-check.

**Consequences**: The model extends to contextual authorization later by adding a condition to the
role assignment (for example, "risk:approve only within unit X") without changing the guard's call
sites — the extension point Constitution III anticipates.

---

## ADR-004: Organizational scope by materialized path, applied in the repository

**Context**: FR-025 (confirmed with the user) requires scope enforced on every risk read and write in
this release, with a global scope grant for org-wide roles and a unit grant extending to descendants.

**Decision**: `organizational_unit` carries `parentId` and a materialized `path` column
(`/{rootId}/{childId}/...`) maintained on insert and reparent, with a `text_pattern_ops` index. A user
holds one or more `OrgScopeGrant` rows, each either a unit grant or `GLOBAL`.

`ScopeResolver` turns the caller's grants into a concrete set of unit identifiers — for a global grant,
a sentinel meaning "unrestricted"; otherwise every unit whose path is prefixed by a granted unit's
path. The resolved set is cached in Redis keyed by `userId:orgTreeVersion:grantsVersion`.

Enforcement lives in the **repository layer**, not in controllers: every risk query method takes a
required `ScopeFilter` argument and applies `orgUnitId IN (...)`. A repository method that does not
accept a scope filter does not exist, so a caller cannot forget one.

**Rationale**: Making the scope filter a required parameter converts "remember to filter" from a review
discipline into a compile error. Placing it below the application layer means a future module inherits
the same enforcement by using the same base repository.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Recursive CTE per request | Simplest and fully normalized, but puts tree traversal on the hottest path in the system — every register page, every dashboard tile, every risk read |
| Closure table | Faster arbitrary ancestry queries and cleaner reparenting, but adds a second table with O(depth × subtree) maintenance for a tree of roughly 1,000 nodes — more machinery than the problem needs |
| PostgreSQL row-level security | Enforcement lives closest to the data, but the policy needs the acting user in a session variable, which fights Prisma's connection pooling and makes the rule invisible to application tests |
| Denormalize the path onto `risk` | Would make register filtering a single prefix scan, but every org reparent would rewrite potentially every risk row — a large write amplification on an audited table |

**Trade-offs accepted**: The `path` column is a denormalization requiring maintenance on reparent
(a bounded subtree update inside the same transaction, with the change audited). Recorded in the plan's
Complexity Tracking.

**Consequences**: Reassigning a risk to a unit outside the actor's scope is refused (FR-025c). A risk
moving out of a user's scope disappears from their register on the next request, satisfying the
scope-change edge case.

---

## ADR-005: Transactional, append-only audit

**Context**: FR-031 to FR-038 require one centralized audit capability recording actor, timestamp,
action, entity type, entity id, previous and new values and request context; append-only; reusable by
future modules. Constitution IV forbids per-module audit implementations.

**Decision**: A `RequestContext` (actor, session id, IP, user agent, correlation id) is captured by an
interceptor into `AsyncLocalStorage`. `AuditRecorder.record(...)` is called **explicitly from the
application layer**, inside the same database transaction as the change it describes. Prisma's
interactive transactions carry the audit insert and the business write together: a rolled-back change
leaves no audit entry, and an audited entry always corresponds to a committed change.

`audit_event` stores `actorUserId`, `occurredAt`, `action`, `entityType`, `entityId`,
`previousValues` (JSONB), `newValues` (JSONB), `ipAddress`, `userAgent`, `sessionId`, `correlationId`,
`organizationalUnitId`. Append-only is enforced at the database, not by convention: the application
role is granted `INSERT`/`SELECT` only, and a `BEFORE UPDATE OR DELETE` trigger raises an exception —
so even a privileged mistake fails loudly.

A field allow-list per entity type controls what enters `previousValues`/`newValues`; secrets, hashes
and session identifiers are never eligible (FR-035).

**Rationale**: Automatic capture from ORM middleware records *table diffs*, but audit requires
*business meaning* — "risk accepted", not "column status changed". Explicit calls in the application
layer are where that meaning exists. Transactional coupling is what makes the trail trustworthy;
best-effort or asynchronous audit would allow a committed change with no record, which is precisely the
failure a GRC platform cannot have.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Prisma middleware auto-auditing every write | Produces table-level noise without business actions, cannot express "who approved what", and silently audits internal bookkeeping writes |
| Asynchronous audit via a queue | Decouples audit durability from the change; a lost message means an unaudited change — unacceptable under Constitution IV, and it would pull in a broker this release does not otherwise need |
| Database triggers writing audit rows | Cannot see the acting user or request context without smuggling it through session variables, and moves business semantics into SQL where it is untestable by the unit suite |
| PostgreSQL logical decoding into an audit store | Operationally heavy, no business action names, and the trail would lag the change |

**Trade-offs accepted**: A developer adding a new audited operation must remember the `AuditRecorder`
call. Mitigated by making it a required step in the application-service template, and by integration
tests that assert an audit row exists for every audited use case.

**Consequences**: `audit_event` grows without bound by design. It is partitioned by month from the
outset so retention and archival can be handled by detaching partitions, without the schema change
Constitution XV warns about later.

---

## ADR-006: Risk calculation and lifecycle owned by the domain

**Context**: FR-061 to FR-070 and FR-079 to FR-085 require a configurable methodology, platform-derived
risk levels, centralized rules and an explicit validated lifecycle. Constitution VI forbids duplicated
calculation logic; Constitution VII forbids implicit transitions.

**Decision**: Two pure domain services in `modules/risk/domain`, with no I/O and no framework imports:

- `RiskScoringService.score(factors, methodologyVersion) → { score, level }` — the only place a risk
  score or level is ever computed. Consumed by assessment creation, the register's level filter, and
  dashboard aggregates alike.
- `RiskLifecycle` — a declarative transition table, one row per legal transition:

  | from | to | permission to **request** | preconditions | approval required (decided with `risk:approve`) |
  |------|----|--------------------------|---------------|--------------------------------------------------|
  | `DRAFT` | `IDENTIFIED` | `risk:edit` | required fields complete | no |
  | `IDENTIFIED` | `ASSESSED` | `risk:assess` | ≥1 assessment exists | no |
  | `ASSESSED` | `UNDER_TREATMENT` | `risk:treat` | treatment decision exists | no |
  | `ASSESSED` / `UNDER_TREATMENT` | `UNDER_REVIEW` | `risk:transition` | — | no |
  | `ASSESSED` / `UNDER_TREATMENT` / `UNDER_REVIEW` | `ACCEPTED` | `risk:transition` | ≥1 assessment exists | **yes** |
  | `ACCEPTED` / `UNDER_TREATMENT` / `UNDER_REVIEW` | `CLOSED` | `risk:transition` | — | **yes** |
  | `CLOSED` | `ARCHIVED` | `risk:administer` | — | no |
  | `UNDER_REVIEW` | `ASSESSED` | `risk:assess` | new assessment recorded | no |

  **Requesting and deciding are separate permissions.** Requesting an approval-gated transition
  requires only `risk:transition`; granting or rejecting it requires `risk:approve`. Collapsing the two
  onto `risk:approve` would mean every user able to *propose* acceptance already holds the permission
  to *grant* it, which would hollow out FR-029a — the `approver ≠ requester` check would be the only
  remaining control, and any two approvers could rubber-stamp each other. Keeping them distinct lets an
  organization grant `risk:transition` broadly and `risk:approve` narrowly, which is what segregation of
  duties means in practice.

  Any (from, to) pair absent from this table is refused. The table is data, so adding an approval gate
  later is a data change, not a restructuring (FR-029d).

Residual risk is captured as post-control probability and impact supplied by the assessor, scored
through the same service, with the controls considered recorded on the assessment. A
control-effectiveness coefficient is left to a future methodology version rather than invented now.

**"Risk level" always means residual by default.** The specification says "risk level" unqualified in
the register requirements (FR-088, FR-091) while the model carries both inherent and residual. Filtering
and sorting therefore take an explicit `riskLevelBasis` parameter defaulting to `RESIDUAL`, because
residual is the level a risk manager acts on — it is the exposure that remains after controls. Inherent
remains selectable, so the "have our controls actually reduced anything" comparison stays available.
Defaulting silently to one basis without naming the parameter would make two users reading the same
register disagree about what a filter meant.

Approval is a pending condition, not a tenth state (FR-029c): requesting an approval-gated transition
creates an `Approval` row with status `PENDING`; the risk stays in its current state. Approval applies
the transition; rejection clears the condition. `approverUserId !== requesterUserId` is enforced in the
domain service, so it holds regardless of which entry point is used.

**Rationale**: Putting scoring in a pure function makes exhaustive matrix-cell and band-boundary
testing trivial (Constitution VI) and makes it impossible for the register filter and the detail page
to disagree. A transition table beats scattered `if` statements because the complete rule set is
reviewable by a risk manager at a glance.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Score in the database as a generated column | Fast, but hides business rules in DDL, cannot express a versioned matrix, and makes a methodology change a schema migration |
| Score in the frontend for responsiveness | Explicitly forbidden by the input and Constitution VI; guarantees drift between what is shown and what is stored |
| A general workflow engine | Enormous surface for one state machine with eight states; premature abstraction |
| Modeling `PENDING_APPROVAL` as a lifecycle state | Doubles the state count as gates are added and breaks the eight-state model the specification fixed |

**Trade-offs accepted**: The assessor enters residual probability and impact by judgment rather than
having them derived from control effectiveness. This matches common enterprise practice and avoids
inventing an unapproved algorithm; the methodology version makes a later derived model additive.

---

## ADR-007: Historical data as append-only domain records

**Context**: FR-064 to FR-068, FR-073, FR-102 and FR-105 require preserved assessments, superseded
treatment decisions retained, no silent overwrite, and a chronological history view. Constitution V
forbids uncontrolled hard deletion.

**Decision**: Four categories, each handled by the mechanism that fits it:

1. **Point-in-time evaluations** — `RiskAssessment` rows are immutable and append-only. The risk holds
   `currentAssessmentId`; reassessment inserts a new row and repoints. Nothing is ever updated.
2. **Decisions** — `RiskTreatmentDecision` rows are immutable and append-only, with a `supersededAt`
   stamp on the previous one; the same pattern applies to `RiskLifecycleTransition` and `Approval`.
3. **Field-level changes** — carried by `audit_event` previous/new values (ADR-005). No parallel
   change-log table exists; duplicating it would create two sources of truth.
4. **Removal** — risks are archived, never deleted. Attachments and comments are withdrawn with a
   `deletedAt` marker preserving attribution and the audit link.

The risk History view is a **query** that merges assessments, treatment decisions, lifecycle
transitions, approvals and ownership-change audit entries into one chronological, attributed stream. It
is not a stored table.

Methodology versioning (FR-068): `RiskMethodology` has immutable `RiskMethodologyVersion` rows. Every
assessment stores its `methodologyVersionId`, so a matrix change never rescores history — historical
levels remain interpretable under the methodology in force at the time.

**Methodology change while an assessment is being entered.** The edge case requires the assessment to
either complete under the version it started with or be refused — never to be silently rescored. The
rule is: a submitted assessment names the `methodologyVersionId` it was prepared against, and the
submission is **refused with `422`** if that version is no longer the active one. No grace window and no
acceptance of superseded versions. The alternative — accepting the immediately-preceding version for
some interval — introduces a configurable window, a "which versions are still acceptable" rule, and two
assessments recorded minutes apart under different methodologies with no way for a reader to tell why.
Refusing costs the assessor one re-entry against the current scales, which is rare (methodology changes
are administrative events) and always correct. The frontend surfaces the refusal as a prompt to reload
the scales, preserving entered factor values where they remain valid.

**Rationale**: Each preserved thing already has a natural entity. Assessments and decisions are domain
records in their own right, so making them immutable is the least machinery that satisfies the
requirement, and it keeps history queryable with ordinary indexed SQL.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Temporal/system-versioned tables (`valid_from`/`valid_to` on every table) | Uniform but heavy: every query needs a temporal predicate, Prisma has no first-class support, and it records row versions rather than the business events auditors ask about |
| Event sourcing the risk aggregate | Perfect traceability at the cost of projections, replay and a rebuild story — vastly disproportionate for one domain, and Constitution VIII forbids the premature abstraction |
| A single generic `entity_history` table | The generic structure Constitution I warns against; loses type safety and referential integrity, and makes "show me every assessment" a JSON query |
| Soft-delete flags everywhere | Every query needs a `deletedAt IS NULL` predicate that is easy to forget and fails open — dangerous for a scoped, audited system |

**Trade-offs accepted**: The History view assembles several queries rather than reading one table.
Bounded per risk and covered by indexes on `(riskId, occurredAt)`; if it ever becomes hot, it can be
materialized without changing the write path.

---

## ADR-008: Explicit relational modeling; enums for closed sets, tables for configurable ones

**Context**: The input forbids EAV modeling for business-critical entities and requires referential
integrity, constraints, indexes and migration safety. Constitution I requires explicit relationships.

**Decision**:

- **PostgreSQL enums** for sets the *platform* defines and the organization cannot change:
  `RiskStatus`, `TreatmentStrategy`, `ApprovalStatus`, `PermissionAction`, `AuthenticationMethod`,
  `TreatmentActionStatus`. Adding a value is a reviewed migration — desirable, because these values
  carry business rules.
- **Reference tables** for sets each *organization* configures: `RiskCategory`, `RiskType`,
  `RiskOrigin`. These need names, descriptions, ordering and activation, so they are rows.
- **Explicit join entities** with their own meaning: `RiskControlLink` (carries how the control relates
  to the risk and when it was linked), `RiskProcessLink`, `RiskAssetLink`. No polymorphic
  `related_entity(type, id)` table.
- **Constraints as first-class**: `NOT NULL` on everything the domain requires; FKs with deliberate
  `ON DELETE` behavior (`RESTRICT` for anything historically relevant); `UNIQUE` on `risk.code`,
  `user.email`, `permission.identifier`, `(riskId, controlId)`; `CHECK` constraints for scale bounds
  and for `approverUserId <> requesterUserId` as a database-level backstop to the domain rule.
- **Indexes** derived from actual access paths, not guesswork: `(orgUnitId, status)`,
  `(orgUnitId, inherentLevel)`, `(orgUnitId, residualLevel)`, `(nextReviewDate)`, `(ownerUserId)`,
  `(code)`, plus a GIN trigram index on `code || title || description` for search.
- **Free-form JSONB is used only for audit payloads**, where the shape is genuinely heterogeneous.

Comments and attachments are the one place a polymorphic reference is justified — they must serve
every future module — and are modeled as `(entityType, entityId)` with `entityType` an enum, validated
by the application against a registry of participating entities. This is a deliberate, documented
exception under Constitution I's "without a documented architectural justification" clause.

**Rationale**: Explicit columns and FKs let the database enforce Constitution V rather than trusting
application code. Splitting closed sets from configurable sets avoids both extremes: enums for values
that carry rules, tables for values the customer owns.

**Alternatives considered**: A generic `entity_attribute` table for extensibility — rejected outright;
it destroys referential integrity, type safety and query performance, and is the explicit anti-pattern
named in both the constitution and the planning input. Storing enums as free strings — rejected: no
database-level guarantee and typos become data.

**Trade-offs accepted**: Adding a lifecycle state or treatment strategy requires a migration. This is a
feature: those values have rules attached, and a reviewed migration is the control point Constitution
XV asks for.

---

## ADR-009: REST contracts — versioned, DTO-bounded, problem+json, offset pagination

**Context**: FR-030, FR-086 to FR-090, FR-106 and FR-107 plus Constitution XIII require explicit
contracts, boundary validation, consistent errors, a versioning strategy, and no database models
exposed as API contracts.

**Decision**:

- **Versioning**: URI-versioned `/api/v1/...`. Additive changes ship in `v1`; a breaking change opens
  `v2` with `v1` retained through a deprecation window (Constitution XV).
- **DTOs**: request and response DTOs are hand-written classes decorated for `class-validator` and
  `@nestjs/swagger`. Prisma models never cross the presentation boundary. A response mapper per
  resource is the only place a domain object becomes a DTO — so an added database column cannot leak
  into a response by accident.
- **Validation**: a global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`
  strips and rejects unknown properties at the boundary.
- **Errors**: RFC 9457 `application/problem+json` — `{ type, title, status, detail, instance,
  correlationId, errors[] }`. A global exception filter maps domain errors to status codes and ensures
  no stack trace, SQL fragment or internal identifier reaches a client. Authorization failures on
  records the caller may not see return `404`, not `403`, so existence is not disclosed (FR-030).
- **Pagination**: offset-based (`page`, `pageSize`) with `pageSize` capped at 100 and a `total` count.
  Chosen over cursor pagination because FR-086 requires a visible total and the register's professional
  users need jump-to-page and stable sort-by-any-column.
- **OpenAPI**: generated from decorators at build time into `openapi.json`, checked into the repo, and
  used to generate `packages/api-types`. CI fails if the committed document is stale — the contract
  cannot drift from the implementation.

**Alternatives considered**:

| Alternative | Rejected because |
|-------------|------------------|
| Header or media-type versioning | Harder to inspect in logs, proxies and support conversations; URI versioning is the least surprising for an enterprise REST API |
| Cursor pagination | Better for deep pages, but cannot provide a total count or jump-to-page, both required by the register |
| Returning Prisma types directly | Fast to write, but every schema change becomes an unreviewed API change — explicitly forbidden by the input |
| GraphQL | Not requested; would add a second contract language, and its flexible query surface complicates scope enforcement and rate limiting |
| Ad-hoc `{ message }` errors | No machine-readable structure; problem+json is the standard the frontend can handle uniformly |

**Trade-offs accepted**: Deep offset pages (`OFFSET 40000`) degrade. Mitigated by covering indexes and
the observation that professional users filter rather than page to the end; if it becomes real, a
keyset "next page" path can be added alongside without breaking the contract.

---

## ADR-010: File storage behind a port; attachments served only through authorization

**Context**: FR-096 to FR-100 require attachments with ownership, access control, metadata and audit;
the input requires future S3-compatible storage without changing business code.

**Decision**: A `FileStorageProvider` port — `put(stream, metadata) → storageKey`, `get(storageKey) →
stream`, `delete(storageKey)` — with `LocalDiskStorageProvider` as the only adapter in this release,
writing to a configured directory under content-addressed keys. Metadata (original name, size, MIME
type, uploader, parent entity, checksum) lives in PostgreSQL; the provider stores bytes and knows
nothing about risks.

Attachments are **never** served from a static path. Every download goes through
`GET /api/v1/attachments/{id}/content`, which authorizes against the parent record's permissions and
scope, then streams with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: default-src 'none'` and the stored MIME type constrained to the allow-list.
Uploads are validated on declared type, sniffed magic bytes, and size; stored filenames are generated,
never derived from user input.

**Rationale**: The port is justified by a concrete, stated future requirement rather than speculation,
and it is small. Serving through an authorizing endpoint is the only way FR-098 can hold — a static URL
is an unauthenticated capability the moment it is shared.

**Alternatives considered**: Storing files as `bytea` in PostgreSQL — simple and transactional, but
bloats the database and its backups, and complicates the S3 move. Pre-signed URLs — an S3 concept with
no local equivalent, and it would bypass the authorization check on every subsequent access.

**Trade-offs accepted**: Downloads consume an API worker for the duration of the stream. Acceptable at
this scale; the S3 adapter can add short-lived pre-signed URLs later, issued only after the same
authorization check.

---

## ADR-011: Module boundaries enforced by tooling

**Context**: Constitution I and VIII require bounded domains and low coupling; the input requires
boundaries that let future modules be added incrementally.

**Decision**: Three rules, enforced by `eslint-plugin-boundaries` in CI, not by review:

1. `core/**` must not import from `modules/**`.
2. `modules/a/**` must not import from `modules/b/**`. Cross-domain needs go through a port published
   by the owning module.
3. Within a module, imports point inward only: `presentation → application → domain`, and
   `infrastructure` may implement domain ports but nothing may import `infrastructure` except the
   module's own composition root.

Extension points a future module uses. Four are exercised by Risk Management today, so they are
proven rather than theoretical: the permission seed registry, the navigation registry (frontend),
`AuditRecorder`, and the scoped repository base. Three are designed but **not yet built**, and must not
be relied on as if they existed: the dashboard card contribution point (the dashboard currently
declares its cards as literal arrays in `apps/web/src/app/(app)/dashboard/page.tsx`, with no registry —
T199 builds it), and the comments/attachments entity-type registry and the notification port (both US9,
Phase 11 — `core/` has no `comments`, `files` or `notifications` capability yet).

T206a is what settles this: it verifies SC-011 by adding a throwaway probe module that exercises *every*
extension point. Until it passes, "a new module needs no change to the shell, `core/` or Risk
Management" is a design intent for three of these seven, not a demonstrated property.

**Rationale**: A boundary that only exists in a document erodes on the first deadline. A lint rule
fails the build.

**Alternatives considered**: Separate npm packages per module — stronger isolation, but adds build
graph complexity and slows iteration for a single deployable. Nx-style enforced tags — equivalent
outcome with a heavier toolchain than a two-app workspace warrants. Trusting code review — the
documented failure mode.

**Trade-offs accepted**: Cross-module needs require a deliberate port, which is friction. That friction
is the point.

---

## ADR-012: Observability separated from audit

**Context**: FR-107 to FR-109 and Constitution XII require structured logs in distinguishable
categories, no sensitive data in logs, and health checks.

**Decision**: `pino` with a correlation id generated per request and propagated through
`AsyncLocalStorage`. Four explicit categories on every entry — `security` (authentication,
authorization failures, rate limiting), `audit_ops` (operational facts about the audit subsystem, never
the business trail itself), `error`, `operational`. A redaction list removes cookies, authorization
headers, password fields, session identifiers and known sensitive keys before serialization.

Business audit lives in PostgreSQL (ADR-005); logs are operational telemetry. They are never the same
record, and the audit trail never depends on log retention.

`/health/live` reports process liveness; `/health/ready` checks PostgreSQL and Redis connectivity.
Neither exposes version details or dependency internals to unauthenticated callers.

**Alternatives considered**: Logging audit events to stdout as the trail — rejected; log pipelines drop
and rotate, which is not an evidentiary store. OpenTelemetry tracing now — deferred; correlation ids
are sufficient for a single process, and the seam remains open.

---

## ADR-013: Optimistic concurrency on risks

**Context**: FR-103 and the concurrent-edit edge cases require conflicting writes to be surfaced rather
than silently resolved last-write-wins.

**Decision**: `risk.version` is an integer incremented on every mutation. The update runs
`WHERE id = ? AND version = ?` and a zero-row result raises a `409 Conflict` carrying the current
state. Lifecycle transitions use the same mechanism, so two concurrent transitions cannot both apply
(FR-085).

**Transport**: the version travels as an HTTP entity tag, not as a body field. `GET /risks/{id}`
returns the version as an `ETag`, and every mutation of a risk or a risk-owned child requires that
value in an `If-Match` header — a missing header is `400`, a stale one is `409`. Using the standard
concurrency headers rather than a body field means the rule holds uniformly across sub-resources,
transitions and approval decisions, several of which have no natural body field to carry it, and it
keeps the version out of write DTOs that are otherwise `additionalProperties: false`. See
[contracts/README.md](./contracts/README.md) for the header contract and the `VersionConflictProblem`
response shape.

**Rationale**: The realistic conflict window in a GRC tool is minutes — a user with a risk form open —
which is far too long for pessimistic locking. Optimistic locking costs one column and surfaces the
conflict where a human can resolve it.

**Alternatives considered**: `SELECT ... FOR UPDATE` — holds a transaction across user think-time, which
is untenable. Last-write-wins — silently destroys a colleague's work in a system of record; forbidden by
Constitution V. Field-level merge — complex, and ambiguous for interdependent risk fields.

**Trade-offs accepted**: Users occasionally see a conflict message and must reload. The frontend
preserves their entered values so nothing is lost.

---

## ADR-014: Single origin — Next.js proxies the API

**Context**: FR-019 requires session credentials unreadable by client scripts, which means an httpOnly
cookie, which is simplest and safest when frontend and API share an origin.

**Decision**: The browser talks to one origin. In development, Next.js `rewrites` forward `/api/*` to
the NestJS container; in production a reverse proxy fronts both. Cookies are first-party with no CORS
configuration and no cross-site cookie semantics. React Server Components that need data call the API
server-side, forwarding the incoming cookie. Client components use TanStack Query against the same
relative `/api/v1` paths.

**Rationale**: Cross-origin cookie authentication requires `SameSite=None; Secure`, permissive CORS with
credentials, and careful preflight handling — a materially larger attack surface for no benefit, since
both applications are deployed together.

**Alternatives considered**: Separate origins with CORS — more moving parts and weaker CSRF posture. A
full BFF in Next.js route handlers re-implementing endpoints — duplicates the contract and creates a
second authorization surface, which is exactly what Constitution III forbids.

**Trade-offs accepted**: The frontend must be reachable for the API to be used in the standard
deployment. Acceptable — they ship as one product.

---

## ADR-015: No asynchronous infrastructure in this release

**Context**: The input asks that asynchronous workloads be introducible later without coupling business
logic to a queue. Constitution VIII forbids premature abstraction.

**Decision**: No queue, no scheduler, no broker in this release. Nothing in scope requires work outside
a request: overdue reviews and overdue treatment actions are computed on read from indexed date columns,
which is correct by construction (no staleness) and cheap at the target volume. In-app notifications are
written synchronously in the same transaction as the event that causes them.

The seam is documented rather than built: application services are already the transaction boundary and
the only place a job would be enqueued, so introducing a queue later means adding a port and moving a
call — no business logic changes. A port is deliberately **not** defined now, because an interface with
no second implementation and no current caller is the premature abstraction the constitution forbids.

**Alternatives considered**: BullMQ now with a nightly overdue-scan job — adds a worker process, a
failure mode and a staleness window to replace a `WHERE nextReviewDate < now()` predicate. Introducing
an empty `JobQueue` port for future-proofing — an abstraction with zero implementations, providing no
guarantee it will fit the eventual need.

**Trade-offs accepted**: Outbound email notifications will require this decision to be revisited. That
is expected and additive; it is named as a future dependency, not a debt.

---

## Summary of research outcomes

| Area named in the planning input | Decision |
|----------------------------------|----------|
| Authentication | ADR-001 — `AuthenticationProvider` port, local argon2id adapter, directory sync as integration |
| Session management | ADR-002 — opaque server-side sessions, PostgreSQL authoritative, Redis cache, httpOnly cookie |
| Authorization | ADR-003 — `resource:action` RBAC, one guard, versioned permission cache |
| Organizational scope | ADR-004 — materialized path, resolved scope set, enforced in the repository layer |
| Audit | ADR-005 — explicit transactional recording, database-enforced append-only, monthly partitions |
| Risk calculation | ADR-006 — pure domain scoring service and declarative lifecycle table |
| Historical data | ADR-007 — append-only domain records plus methodology versioning; history is a query |
| Database modeling | ADR-008 — explicit relations, enums for closed sets, reference tables for configurable sets, no EAV |
| API contracts | ADR-009 — `/api/v1`, DTO-bounded, problem+json, offset pagination, generated OpenAPI |
| File storage | ADR-010 — storage port, local adapter, authorization-gated streaming downloads |
| Module boundaries | ADR-011 — lint-enforced dependency rules and named extension points |
| Observability | ADR-012 — categorized structured logs distinct from audit, health endpoints |
| Concurrency | ADR-013 — optimistic locking with `409` on conflict |
| Frontend/API topology | ADR-014 — single origin, Next.js proxies the API |
| Asynchronous work | ADR-015 — none in this release; the seam is documented, not abstracted |
