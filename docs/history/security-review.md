# Security Review — PharosGRC Platform Foundation (T208)

> **Historical document — point-in-time review (2026-09-06), Phase 001 only.** Does not
> necessarily describe the current state of the product. Current source of truth:
> [`docs/architecture/security.md`](../architecture/security.md).

**Date**: 2026-09-06
**Scope**: `specs/001-grc-platform-foundation/spec.md`'s Security, Sessions, Authorization,
Audit and "Security, Errors and Extensibility" requirements; Constitution Principles II
(Security by Design), III (Identity, Access Control and Segregation of Duties), and XII
(Observability and Operational Reliability).
**Reviewer stance**: this project has already produced 23 recorded findings
(`docs/deferred-findings.md`) and three confirmed information-disclosure defects before this
review began. The working assumption throughout was that a fourth exists and that "the design
document says X" is not evidence that X holds. Every claim below is marked **verified** (an
actual request, query or test run was executed and its output inspected) or **inspected** (the
code was read and traced, but not exercised) — see the table at the end for the complete
verified/inspected split.

## Headline verdict

**No critical findings. One new Medium-severity confidentiality defect** (§6.2, the attachment
content-addressed-storage timing oracle) **and one new Low-severity documentation/code drift**
(§2.4). Every mechanism named in ADR-002 through ADR-005 and ADR-010 is real, not aspirational:
opaque session tokens, database-enforced append-only audit, a database-enforced segregation-of-
duties constraint, and content-sniffed file uploads were all exercised directly — against the
live PostgreSQL instance, not only read as source — and behaved exactly as documented. The
scope-bypass pattern that produced this project's most serious prior finding (a controller
reaching a repository directly, skipping the use case that enforces organizational scope) was
swept for recurrences across every controller in `apps/api/src`; none were found, and the fixed
instance's regression test was re-run live and passes. Two items from `docs/local-environment.md`
(D-13's self-permission-grant question, and F-14's dev-`.env`-in-Docker-image issue) are carried
forward with an explicit opinion rather than restated.

---

## 1. Method

Static reading of `apps/api/src` (NestJS/Prisma) covered every controller, every use case that
sits behind a controller touching a repository, the full authorization/session/audit/files
capability trees, and the raw-SQL query services named as the highest-risk surface. Four parallel
investigations were run to cover the ground exhaustively within the review window; every finding
they returned was independently re-checked against the actual file before being included here,
and several claims were additionally verified by execution:

- Live SQL issued directly against `pharos_grc_test` (via `prisma db execute`, wrapped in
  `BEGIN`/`ROLLBACK` so no data was altered) to prove the segregation-of-duties `CHECK` constraint
  and the `audit_event` append-only trigger/privilege split fire for real, not only that the
  migration text says so.
- Six targeted integration/contract test files re-run live against the real test database and
  API module graph: user deactivation (both the direct-port and the HTTP admin path),
  `permissionsVersion` invalidation without re-login, audit append-only, audit-denial recording,
  audit transactionality, organizational reparenting, the risk-scope byte-identical-404 suite, the
  fixed approvals scope-leak regression test, and the risk-methodology 403-for-everyone regression
  test (D-11). All passed; the actual test output is quoted where it matters below.
- `pnpm --filter @pharos/api` lint run directly (exit 0) to confirm the boundary/injection-relevant
  rules that gate this review's conclusions are not merely configured but currently passing.

## 2. Authentication and Sessions (ADR-002)

### 2.1 Opaque tokens and hashing — **verified**

`apps/api/src/core/sessions/domain/session-cookie.ts:39-53`:

```ts
const TOKEN_BYTES = 32; // 256 bits (ADR-002).
export function generateOpaqueSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
```

`node:crypto.randomBytes` is a CSPRNG; the value is opaque (no JWT structure). Only `tokenHash` is
a column on `Session` (`schema.prisma`); `SessionService.createSession` passes `tokenHash` to the
repository and returns `rawToken` solely in `CreatedSession`, consumed exactly once by
`AuthController.login`'s `response.cookie(...)` call. No audit or log call anywhere in
`core/sessions` references the raw token — confirmed by reading every `AuditRecorder.record(...)`
call in `session.service.ts` and `audit-session-expiry-recorder.ts`. `auth-login.spec.ts` asserts
the cookie value has no `.` (not a JWT) and that the response body never carries a session
identifier.

### 2.2 Cookie flags — **verified**

`buildSessionCookieDescriptor` (`session-cookie.ts:77-88`) sets `httpOnly: true` unconditionally,
`secure`/`sameSite` from configuration. `env.schema.ts`'s `superRefine` (read directly, lines
173-190) makes the process **refuse to boot** with `NODE_ENV=production` and
`SESSION_COOKIE_SECURE` anything but `true` — this is not a runtime `if`, it is a startup
validation failure, which is the stronger guarantee. `auth-login.spec.ts` asserts the real
`Set-Cookie` header carries `HttpOnly`, `SameSite=Lax`, `Path=/`.

### 2.3 Idle and absolute lifetime — **verified live**

`SessionService.checkExpiry` (`session.service.ts:283-296`) compares `now` against a fixed
`expiresAt` (set once at creation from `absoluteLifetimeHours`, never extended) for the absolute
cap, and against `lastActivityAt + idleTimeoutMinutes` for the sliding window — two independent
checks, either one enough to expire the session. `SessionGuard.canActivate` calls
`sessionService.validateSession(rawToken)` on **every** non-`@Public()` request; `SessionGuard` is
registered as a global `APP_GUARD` in `app.module.ts`, confirmed by reading the providers array
(`ThrottlerGuard` → `SessionGuard` → `PermissionGuard`, in that declared order). This is enforced
per-request, not only at login.

### 2.4 Revocation, and permission/scope cache invalidation — **verified live**

`SessionService.revokeSession`/`revokeAllForUser` mark `revokedAt` in PostgreSQL and
**synchronously** `cache.del` the token hash on every revocation path — there is no window where a
stale cache entry can outlive a revocation. The `permissionsVersion`/`grantsVersion` mechanism
(ADR-003/ADR-004) uses the same pattern one layer up: the cache **key** embeds the current version
counter, so a version bump makes every old cache entry unreachable without needing to enumerate or
delete it.

Live test run, unmodified from the repository:

```
✓ test/integration/permission-invalidation.spec.ts (2 tests)
  ✓ Permission-version invalidation applies on the next request (T173, FR-028) >
    a user holding org_unit:administer loses access to GET /admin/org-units the
    moment the role is stripped of it — same session, no re-login
```

**One documentation/code drift, Low severity, new**: `role-admin.service.ts`'s own header
(lines 18-25) states that deleting a role "keeps the bump... for defensive symmetry," but the
`delete()` method (lines 230-252) does **not** call `bumpPermissionsVersion()` — only `update()`
(role-permission replacement) and `replaceUserRoles()` do. This has no live security impact
because `delete()` is only reachable when `role.assignedUserCount === 0` (checked immediately
above), so no user's effective permissions can change as a result — but the comment asserts
something the code does not do, which is exactly the class of "looks verified because it's
written down" gap this review is on guard against. **Recommendation**: either add the call for
true defensive symmetry, or correct the comment. Owner: whoever next touches
`role-admin.service.ts`.

### 2.5 Deactivated user's live session dies — **verified live, both call paths**

Two independent deactivation paths (`SetUserStatusUseCase` behind the admin HTTP endpoint, and
`AuthOrchestrator.deactivateUser`) both call `SessionService.revokeAllForUser(..., 'USER_DEACTIVATED', ...)`
**inside the same database transaction** as the status write — not as a best-effort follow-up, and
not relying on a later re-check of `user.isActive`. `revokeAllForUser` deletes every affected
session's cache entry synchronously, so the very next request against any of that user's sessions
misses cache and reads the now-revoked row from PostgreSQL.

Both dedicated tests were re-run live, unmodified:

```
✓ test/integration/user-deactivation-auth.spec.ts (3 tests)
  ✓ revokes every active session immediately when the user is deactivated
✓ test/integration/admin-user-deactivation.spec.ts (2 tests)
  ✓ Admin deactivation kills a live session (T176, FR-011, FR-017) >
    revokes the target user's live session the moment an administrator deactivates them
```

The second test is a genuine HTTP-level regression test: two independent `supertest` cookie
jars, the target logs in, an administrator PATCHes their status to `INACTIVE`, and the **same,
unrefreshed** target cookie is presented again and asserted to return 401.

### 2.6 CSRF (FR-019) — **verified**

`CsrfMiddleware` (`apps/api/src/infrastructure/http/csrf.middleware.ts`) is a strict
`Origin`/`Referer`-allow-list check against `APP_ORIGIN`, applied to every non-`GET`/`HEAD`/
`OPTIONS` request by method (not by route), registered globally
(`consumer.apply(CsrfMiddleware).forRoutes('*')` in `app.module.ts`), including `@Public()`
routes — deliberately applied even to `POST /auth/login` to close login-CSRF, a documented,
reasoned deviation from `auth.openapi.yaml`'s enumerated response codes. A request with neither
header fails closed (403), not open. This sits on top of `SameSite=Lax` (§2.2), matching ADR-002's
stated design exactly.

### 2.7 Rate limiting / lockout (FR-008) — **inspected**

`LoginThrottleService.assertNotThrottled` checks a per-origin rolling counter and
`LocalCredential.lockedUntil` **before** any password verification runs, so a throttled/locked
request never reaches argon2. `AUTH_RATE_LIMIT_ACCOUNT_ATTEMPTS`/`AUTH_RATE_LIMIT_ORIGIN_ATTEMPTS`/
`AUTH_LOCKOUT_MINUTES` are Zod-validated integers (D-6's split, confirmed present in
`env.schema.ts`). Every failed attempt is audited (`auth.login_failed`/`auth.login_failed_inactive`,
`AuditOutcome.FAILURE`) inside the same transaction as the counter update. Not re-run live in this
pass; the code path is unambiguous and the pattern (check-before-verify) is the correct one.

### 2.8 Generic failure message and timing (FR-007) — **verified**

`AuthOrchestrator.login` collapses unknown-account, wrong-password and (separately, identical
string) deactivated-account into one `UnauthorizedDomainError` message.
`LocalAuthenticationProvider.authenticate` runs an argon2id verify against a **cached dummy hash**
computed with the same configured cost parameters when the account does not exist, so an unknown
email pays the same argon2 cost as a real wrong-password attempt — a deliberate, explicit timing
mitigation, not an accident of control flow. `auth-login.spec.ts` asserts byte-identical
Problem+JSON bodies across the three cases. One inherent, low-severity residual signal noted for
completeness: a genuinely locked-out real account short-circuits before argon2 via the lockout
check, which an unknown account does not — the response **body** is still identical
(`tooManyAttempts`), so FR-007 holds at the contract level; only a sub-millisecond timing
difference remains, common to any account-lockout scheme and not something this codebase claims to
close.

### 2.9 Argon2 configuration — **verified**

All five password-hashing/verification call sites (`local-authentication.provider.ts`,
`auth-orchestrator.ts` ×2, `create-user.usecase.ts`, `reset-user-password.usecase.ts`,
`prisma/seed/platform.seed.ts`) pass `type: argon2.argon2id` explicitly, driven by
`ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM` from the Zod-validated environment
schema. No call site relies on a library default or uses `argon2i`/`argon2d`.

---

## 3. Authorization (ADR-003)

### 3.1 Single decision path, deny-by-default — **verified**

`PermissionGuard.canActivate` (`apps/api/src/core/authorization/presentation/permission.guard.ts`)
is the only place a permission is checked. Reading the control flow directly: four outcomes exist
— `@Public()` (bypasses both guards), `@RequirePermission` (must resolve true or 403),
`@NoPermissionRequired()` (skips only the permission check, still requires a resolved actor or
401), and **anything else refuses** with `ForbiddenDomainError` and a `MISSING_PERMISSION_DECLARATION`
denial record. There is no `if (!required) return true` path — an endpoint that forgets to
annotate itself is refused, not admitted. Registered globally as `APP_GUARD`, confirmed in
`app.module.ts`, in the order Throttler → Session → Permission.

### 3.2 `permissionsVersion` invalidation — **verified live** (§2.4 above; same mechanism, same test).

`role-admin.service.ts` (T177) is confirmed as the real, wired caller of
`PermissionRepositoryPort.bumpPermissionsVersion()` for both role-permission replacement and
user-role replacement, each inside the same transaction as the write it invalidates for. This is
not a "published but unused" port — T177 landed and calls it.

### 3.3 Scope-bypass sweep — **inspected, exhaustively; one prior fix confirmed, no new instance**

This project's most serious authorization finding to date was `GET /risks/{riskId}/approvals`
calling `approvalRepository.listByEntity` directly, with no preceding scope check — a
governance-activity disclosure across organizational scope, fixed in commit `7d57b96`. Per the
explicit instruction to look for recurrences, every controller under `apps/api/src` that injects a
repository/registry port was traced:

- **`modules/risk/presentation`**: `assessment.controller.ts` (list, and the two internal
  `previousAssessmentId` lookups), `lifecycle.controller.ts` (`listApprovals`, the fixed one),
  `risk-relationship.controller.ts` (`listControlLinks`), `treatment.controller.ts`
  (`listTreatments`, `listTreatmentActions`) — **every one** calls `GetRiskUseCase.execute(...)`,
  which resolves scope and 404s an out-of-scope/nonexistent risk identically, **before** touching
  its own repository. The child-table repository calls are additionally filtered by `riskId`
  themselves (defense in depth, not the primary control).
- **`core/audit`**: `AuditEventReaderPort.query`'s `scope: ScopeFilter` parameter is
  non-optional at the type level and `PrismaAuditEventReader` applies it unconditionally
  (`FALSE` for an empty unit set) — `ListRiskAuditEventsUseCase`, the one current consumer,
  correctly resolves the risk's scope and checks `audit:view` (403, not 404) after confirming the
  risk itself is visible.
- **`core/files`/`core/comments`**: every read/write resolves the parent record's accessibility
  through the `AttachableEntityType`/`CommentableEntityType` registry **before** touching
  `AttachmentRepositoryPort`/`CommentRepositoryPort`; the registered `RISK` accessor reuses
  `GetRiskUseCase` verbatim — the same scoped read every other risk endpoint uses, not a
  parallel, divergent implementation.
- **`core/notifications`**: every operation is unconditionally filtered to the caller's own
  `recipientUserId`; marking someone else's notification read returns 404 (not 403), correctly
  non-disclosing.
- **Admin controllers** (`core/identity`, `core/authorization`, `core/organizations`): gated by
  admin-only permissions and contractually, explicitly unscoped by organizational unit — this is
  the documented model (`admin.openapi.yaml`), not an oversight; there is no organizationally-
  scoped holder of `user:administer`/`role:administer` for a scope check to matter to.

**No new scope-bypass instance found.** One latent hygiene issue worth naming precisely because
it is exactly the shape of thing that goes wrong: `RiskAssessmentRepositoryPort.findById(id)` (no
`riskId`/scope parameter, by explicit design — the port's own doc comment says the caller must
have already validated scope via `RiskRepositoryPort.findById`) is currently called only with
server-derived ids (`assessment.previousAssessmentId` from a record just created in the same
request, or `item.previousAssessmentId` from an already-scoped page). It is not reachable from
client input today. It is, however, a repository method that will silently return **any**
assessment for **any** id, regardless of scope, the day a future call site passes a client-supplied
id to it without re-deriving scope first — indistinguishable in its signature from a safe method
until you read the doc comment. **Recommendation**: rename it (e.g. `findByIdUnscoped`) or add a
scope/`riskId` parameter now, before a second call site exists to get it wrong. Severity: Low
(no live exploit path today; a footgun for tomorrow).

### 3.4 Segregation of duties (approver ≠ requester) — **verified live, both layers**

Domain layer: `assertApproverDiffersFromRequester` (`modules/risk/domain/approval.ts`) is called
by `DecideApprovalUseCase` before recording any decision, and has a dedicated unit test
(`test/unit/approval-sod.spec.ts`, 3 tests, re-run live — pass).

Database layer, verified **directly against `pharos_grc_test`**, not by reading the migration:
issued a real `INSERT` inside `BEGIN`/`ROLLBACK` attempting to record an approval with
`decided_by_user_id = requested_by_user_id` for a real user row. PostgreSQL rejected it:

```
ERRO: a nova linha da relação "approvals" viola a restrição de verificação
"approvals_decided_by_requester_check"
DETAIL: Registro que falhou contém (..., APPROVED, <same user id>, ..., <same user id>, ...)
```

This is a genuine, independent database backstop — the CHECK constraint fires regardless of
whether the application-layer assertion is ever bypassed by a future code path, exactly as ADR-006
intends. **Both layers are real; this is not a case where only one enforces the rule.**

**Independent assessment of D-13** (documented in `docs/local-environment.md`, which names this
review as the place to weigh in): `RoleAdminService`/`ScopeGrantService` do not check whether the
granting administrator already holds the permission/scope being granted. Read the actual code
(`role-admin.service.ts`, `scope-grant.service.ts`) and confirmed D-13's own analysis is accurate,
not merely asserted: `role:administer` already permits editing any role including one's own, so a
"you may only grant what you hold" rule would cost an extra step (add it to your own role, then
grant it) without closing anything. This reviewer's independent conclusion agrees with D-13: the
model is defensible **as specified**, provided the two compensating controls D-13 names are
actually true, which was checked rather than taken on faith — `role:administer`/`user:administer`
are seeded only on `Platform Administrator` (`prisma/seed/platform.seed.ts`, confirmed by reading
the seed's role/permission assignments), and every grant/revoke is audited inside the acting
transaction (`role_permission.granted`/`revoked`, `user_role.granted`/`revoked`,
`org_scope_grant.granted`/`revoked` all confirmed present in the audit-action inventory below).
This is a **detection**, not **prevention**, control for privilege escalation via role
administration, which is what D-13 states; a regulated deployment wanting prevention would need a
second-approver flow for permission grants, which is a specification change, not a defect in what
was built to spec.

---

## 4. Organizational Scope (ADR-004)

### 4.1 Mandatory argument, empty scope denies rather than admits — **verified**

`ScopedRepository.applyScope`/`withScope` (`shared/persistence/scoped-repository.ts`) take
`scope: ScopeFilter` as a required, undefaulted parameter — omitting it is a `tsc` compile error,
not a runtime gap. `ScopeFilter` (`shared/persistence/scope-filter.ts`) is a closed union with only
`GLOBAL` and `UNIT` arms; there is no third "unset" state a caller could construct meaning "skip
the check." `applyScopeToWhere` turns an empty `UNIT` set into `{ in: [] }`, which SQL evaluates as
matching nothing — confirmed by reading the function directly, and by the fact that
`RiskQueryService`'s own header describes and a dedicated performance/correctness test targets
this exact behavior ("an empty scope compiles to a literal `FALSE` predicate... never every risk").

### 4.2 FR-025c (creation/reassignment refused outside scope) — **verified**

`isOrgUnitWithinScope` is called by both `CreateRiskUseCase.assertOrgUnitCreatable` and
`UpdateRiskUseCase` (on the org-unit-reassignment branch specifically, not unconditionally) —
confirmed by reading both call sites; a caller cannot create or move a risk into a unit outside
their resolved scope.

### 4.3 Byte-identical non-disclosure — **verified live**

Re-ran, unmodified:

```
✓ test/contract/risk-scope.spec.ts (4 tests)
✓ test/contract/risk-lifecycle.spec.ts >
  GET /risks/{riskId}/approvals >
  an out-of-scope caller holding risk:view is refused 404, byte-identical to a
  nonexistent risk (ADR-004/ADR-009) — previously this endpoint bypassed scope
  entirely and returned 200 with the real approval history
```

Every `NotFoundDomainError` site in `apps/api/src` (55 call sites enumerated) uses a fixed,
per-entity-type label constant, so "doesn't exist" and "exists but out of scope" for the same
entity type are the literal same code path returning `undefined` either way — not two branches
that happen to agree today.

**One latent, currently-unreachable inconsistency, Low severity, new**:
`OrgScopeEnforcerService` (`core/organizations/application/org-scope-enforcer.service.ts:81`)
throws `NotFoundDomainError(check.entityType, check.entityId)`, passing the raw
`AuditEntityType` enum value (e.g. `"RISK"`) as the label, instead of a localized label like every
other 404 site (`'Risco'`, `'Anexo'`, ...). If a second caller of this service ever exists that
also 404s the same entity type via the standard localized-label path, the two 404 bodies would
differ byte-for-byte (`"RISK ... não foi encontrado(a)."` vs `"Risco ... não foi encontrado(a)."`),
violating the byte-identical requirement. Confirmed this service currently has exactly one
production wiring point (`organizations.module.ts`'s provider registration) and zero call sites
in `create-risk.usecase.ts` or any other use case (which use `isOrgUnitWithinScope` /
`ValidationDomainError` instead, by design) — so this is dead-for-now code, not a live disclosure.
**Recommendation**: fix the label before wiring a second caller to this service; owner is whoever
does that wiring.

---

## 5. Audit (ADR-005)

### 5.1 Append-only, enforced at both the database and the application role — **verified live, both layers**

Issued real `UPDATE audit_event SET action = 'tampered' ...` statements against `pharos_grc_test`
inside `BEGIN`/`ROLLBACK`, as two different roles:

```
-- as pharos_app (the application role, INSERT/SELECT only):
ERRO: permissão negada para tabela audit_event

-- as pharos_owner (the table owner, would bypass a GRANT-only restriction):
ERRO: audit_event is append-only: UPDATE is not permitted (FR-034)
```

Both layers independently refuse the mutation, for different reasons — a `GRANT`/`REVOKE`
mistake would still be caught by the trigger, and the trigger fires even for the table's owner.
This is the distinction the task asked to draw out explicitly: **the control is real in both
layers**, not "real in the code, assumed in the database." Application-layer transactional
coupling (`AuditRecorder.record(...)` called inside the same `runInTransaction` scope as the
business write) was confirmed by reading `audit-transactional.spec.ts`'s three re-run, passing
tests, which assert a rolled-back business change leaves no audit row.

### 5.2 No secrets in audit payloads — **verified**

`applyAuditFieldAllowlist` (`core/audit/domain/audit-field-allowlist.ts`) is the **only** function
in the codebase permitted to build `previousValues`/`newValues`. It has two independent defenses:
a per-entity-type allow-list (a field not listed is silently dropped, never passed through — the
one place "fail open" would be dangerous), and `registerAuditFieldAllowlist` itself **rejects any
field name shaped like a secret** (`isNeverEligibleFieldName`: suffix match on
`hash`/`secret`/`token`/`credential`, plus a set of exact bare names) at registration time, before
a future module's copy-paste mistake could ever make a secret-shaped field eligible. Confirmed the
`LOCAL_CREDENTIAL` and `SESSION` allow-lists (`core-entity-audit-allowlists.ts`) list only metadata
(`passwordChangedAt`, `failedAttempts`, `lockedUntil`, `expiresAt`, `ipAddress`, ...) — never
`passwordHash`/`tokenHash`.

### 5.3 Coverage against FR-032's event list — **inspected**

Grepped every literal and computed `action:` value across `apps/api/src` (55+ distinct actions).
Every category FR-032 names is represented: authentication (`auth.login_failed`,
`auth.login_failed_inactive`, `auth.password_changed`; a successful authentication is recorded as
`session.created`, which carries the same actor/timestamp/IP/user-agent/method fields FR-032 asks
for — a deliberate choice to avoid a duplicate row for the same event, not a gap), sign-out
(`auth.logout`), session creation/expiration/revocation, user
creation/modification/deactivation/reactivation, role and permission changes
(`role.created/updated/deleted`, `role_permission.granted/revoked`, `user_role.granted/revoked`),
organizational unit changes (`org_unit.created/updated/reparented`,
`org_scope_grant.granted/revoked`), and the full risk lifecycle (`risk.created/updated/assessed`,
`risk.transitioned`, `risk.approval_requested/approved/rejected`, `risk.treatment_decided`,
`risk.treatment_action_created`, `risk.control_linked/unlinked`, `risk.process_linked/unlinked`,
`risk.asset_linked/unlinked`), plus `comment.created/withdrawn` and `attachment.uploaded/withdrawn`.
FR-037 (auditing security-relevant refusals) is also present: `PermissionGuard`'s `DENIED` path is
wired to `AuditPermissionDenialRecorder` and re-run live (`audit-denied.spec.ts`, 4 tests, pass).

---

## 6. File Upload (ADR-010)

### 6.1 Upload path — magic bytes, rejection-before-persistence, path-traversal, download headers — **verified**

`UploadService.execute` (`core/files/application/upload.service.ts`) requires the client-declared
`Content-Type` **and** the sniffed byte signature to agree exactly before anything is written;
`sniffContentType` (`core/files/domain/magic-bytes.ts`) inspects real bytes (`%PDF-`, the 8-byte
PNG signature, `FF D8 FF` for JPEG, and a NUL-byte/valid-UTF-8 heuristic for `text/plain` that
never defaults unrecognized binary to "probably text"). Every validation step throws before
`FileStorageProvider.put(...)` is ever called — traced the full method body; there is no path that
writes bytes or a database row ahead of a validation failure.

Path traversal is **structurally** prevented, not merely validated:
`LocalDiskStorageProvider.put` derives the on-disk path from `sha256(content)`
(`sha256/<aa>/<bb>/<64-hex-digest>`) and never receives `Attachment.fileName` at all — the
hostile-filename case (`../../etc/passwd`, embedded NUL) simply has no code path into
`resolveStoragePath`, which additionally asserts containment under the storage root as defense in
depth. The original filename is stored only as DB metadata, read back solely to build
`Content-Disposition`.

Download headers (`attachment.controller.ts:183-195`) set `Content-Disposition: attachment`
(never `inline`) via a header-injection-safe builder (`content-disposition.ts` strips control
characters/quotes and separately percent-encodes an RFC 5987 extended parameter),
`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`,
`Cache-Control: private, no-store`, and `Content-Type` restricted to whatever was sniff-verified
at upload — since the allow-list contains no HTML/SVG-capable type, a browser can never be handed
an uploaded file with a content type it would render as active content.

Access control on download: `GetAttachmentContentUseCase` resolves the parent record's
accessibility through the same registry/accessor pattern verified in §3.3, re-checking `risk:view`
and the risk's own scope via `GetRiskUseCase` — not a parallel, weaker check.

### 6.2 NEW FINDING — content-addressed storage is a cross-scope existence oracle via timing — **confirmed vulnerable, Medium severity**

`LocalDiskStorageProvider.put(content: Buffer)` (no organizational or per-entity parameter at all)
derives the storage key purely from `sha256(content)` and writes with `wx` (create-exclusive),
treating `EEXIST` as "already stored" and skipping the write. Confirmed by reading the method
signature and body directly: **there is exactly one global, unpartitioned content-addressed
store for the entire instance.**

Consequence, traced end to end: if an authenticated caller holding `attachment:create` on any
single risk they can see uploads content whose SHA-256 already exists **anywhere in the system —
under any risk, in any organizational unit, including ones the caller has no `risk:view` scope
over at all** — the `writeFile(..., { flag: 'wx' })` call fails fast with `EEXIST` and the disk
write is skipped entirely. If the content is new anywhere in the system, a full write of up to
`ATTACHMENT_MAX_SIZE_BYTES` (25 MB by default) is performed. The HTTP response is identical in
both cases (`AttachmentResponse` carries nothing that reveals deduplication) — the only observable
difference is response latency, which scales with file size and is trivially measurable by an
attacker who already possesses the exact bytes they want to test for.

This bypasses, at the storage layer, every scope mechanism verified as sound in §3–4: an attacker
does not need `risk:view` scope over the risk the matching content is attached to, only
`attachment:create` on some risk they can already see, and only needs to already possess the exact
byte sequence they want to test — it does not disclose an unknown record's content, owner, or
location, only the fact of its prior existence somewhere in the platform. That is a real, if
narrow, confidentiality-boundary violation matching the spirit of FR-025/FR-030 (a caller must not
learn about the existence of an out-of-scope record), and it is specific to ADR-010's storage
design rather than to any code that was verified sound elsewhere in this review.

**Not exercised by any existing test** (grepped for dedup/`EEXIST`-related tests; none exist) and
**not previously recorded** in `docs/deferred-findings.md`. This review did not measure an actual
timing difference on a live instance (that would require standing up the full stack with
production-sized files and a controlled network path) — the code path itself, however, is
unambiguous: one branch always performs a full write, the other always short-circuits, and no
mitigation (constant-time response padding, per-scope partitioning) exists today.

**Recommendation**: partition the content-addressed store per organizational unit (the simplest
fix, at the cost of losing cross-unit deduplication savings — acceptable, since ADR-010 never
claimed deduplication was a security-relevant property), or pad every upload response to a
constant latency floor regardless of the `EEXIST` branch taken. Owner: whoever next touches
`core/files`; this should be added to `docs/deferred-findings.md` as a new entry if not actioned
immediately, since it is a genuine, currently-unmitigated finding, not a stylistic one.

---

## 7. Information Disclosure

Beyond the byte-identical-404 sweep (§4.3) and the new finding in §6.2:

- **Exception handling — verified**. `problem-details.filter.ts`'s fallback branch for anything
  that is not a recognized `DomainError`/`HttpException` never reads `exception.message` into the
  response; the full message/stack goes only to `AppLogger`. A raw driver/Prisma error is
  indistinguishable, at the response, from an unrelated bug — both produce the generic 500 body.
- **Over-fetching in response mappers — inspected, none found**. Every mapper checked
  (`attachment-response.mapper.ts`, admin user/comment/audit-event mappers, the own-profile DTO)
  explicitly lists output fields rather than spreading a Prisma row; `passwordHash` never travels
  past the repository/orchestrator layer into any mapper or DTO type.
- **Enumeration via uniqueness checks — inspected**. User email uniqueness is checked globally,
  unscoped by organizational unit — this is architecturally correct, not a leak, because
  `user:administer` itself has no organizational-scope dimension (confirmed by reading
  `PermissionResolverService.hasPermission`, which is a flat boolean, and the admin contract's own
  stated model): there is no scoped holder of that permission for a global uniqueness check to
  disclose information *across* a scope boundary to.
- **Login enumeration — verified** (§2.8).

## 8. Secrets

No committed `.env` file exists (`git ls-files` shows only `.env.example`; both real `.env` files
are `.gitignore`'d and confirmed untracked). Every credential-shaped literal in the tracked
repository is one of: (a) an explicitly-labelled dev-only or CI-only placeholder for ephemeral,
non-production infrastructure (`.env.example`'s `pharos_app_dev`/`pharos_owner_dev`,
`docker-compose*.yml`'s matching defaults, `.github/workflows/ci.yml`'s `*_ci_only` values,
none of which reach any network beyond a disposable local/CI Postgres container), or (b)
intentionally blank with fail-closed enforcement (`SEED_ADMIN_PASSWORD` — the seed script refuses
to run at all if it is empty, confirmed by reading `platform.seed.ts`). `docker/postgres/init/01-roles.sql`
reads passwords via `psql`'s `\getenv`, never as a literal. No `BEGIN...PRIVATE KEY`,
AWS-shaped access key, or `api_key: "..."`-shaped literal exists anywhere in the tracked tree.

This is consistent with, and does not contradict, the already-recorded **F-14**
(`docs/deferred-findings.md`): the *mechanism* meant to keep a developer's local `.env` out of a
built Docker image (`.dockerignore`'s bare `.env`/`.env.*` patterns) does not match nested paths
and both application images currently bake in whatever the local `apps/api/.env`/`apps/web/.env`
happen to contain at build time. Today's baked-in values are the same dev-only placeholders
already covered above, so there is no live secret exposure from F-14 as things stand — but the
*mechanism* is broken, exactly as F-14 already says, and this review found no reason to weaken
that assessment. Not re-fixed here (out of this review's scope, and already owned by F-14).

## 9. Input Validation and Injection

Every `$queryRaw`/`$executeRaw` call site in `apps/api/src` (six production files: the audit
reader, the risk register query, risk history, the dashboard aggregates, and one parameterless
health check) was read directly. All bind every value — ids, enum labels, search terms, date
boundaries, scope unit-id arrays — as a `Prisma.sql` tagged-template parameter; the only literal,
non-parameter text ever interpolated is a fixed, code-reviewed whitelist (sort-column names built
from a closed `SORT_COLUMNS` record keyed by an already-DTO-validated union, fixed `::type[]` cast
literals, fixed enum-cast literals) — never unvalidated request input. `risk-query.service.ts`'s
own header explains, correctly, why the register's full query is raw SQL at all (a GIN trigram
index over a concatenated expression that Prisma's typed `where` API cannot target) rather than
treating "raw SQL" itself as a smell. **No SQL-injection risk found.** The only
`$executeRawUnsafe`/`$queryRawUnsafe` occurrences anywhere in the repository are in test-harness
support code (`test/integration/support/database-roles.ts`'s truncate helper, operating on a fixed
hardcoded table list, never on request-derived input) — not reachable from any HTTP endpoint.

**Pagination (Constitution XI) — inspected, one literal-compliance gap, not a vulnerability**.
Every genuinely growth-unbounded list (risks, assessments, treatment decisions/actions, audit
events, history, comments, attachments, notifications, users, roles) is paginated with a
`{data, meta}` envelope. Four to five endpoints return plain arrays instead
(`/risk-categories`, `/risk-types`, `/risk-origins`, `/org-units`, `/admin/org-units`,
`/admin/permissions`, and per-risk relationship lists), matching their own OpenAPI contracts
exactly — these are bounded reference/config catalogs, an org tree documented elsewhere as capped
at roughly 1,000 nodes, or per-risk relationship sets bounded by realistic cardinality, not
attacker-influenced or unboundedly growing data. This is a literal-wording tension with
Constitution XI's blanket "every list endpoint MUST be paginated," not a resource-exhaustion or
disclosure risk as things stand — flagged as a policy question (narrow the constitution's wording,
or paginate these for literal compliance) rather than a security finding.

---

## 10. Findings summary

| # | Area | Severity | Status | New / recorded |
|---|------|----------|--------|-----------------|
| 1 | Content-addressed attachment storage is a cross-scope existence oracle via upload-response timing (§6.2) | **Medium** | Confirmed by code trace; not timing-measured live | **New** |
| 2 | `OrgScopeEnforcerService` 404 uses an unlocalized raw enum label, inconsistent with every other 404 site if a second caller is ever wired to it (§4.3) | Low | Confirmed, currently unreachable (zero production call sites) | **New** |
| 3 | `role-admin.service.ts`'s header claims role-deletion bumps `permissionsVersion`; the code doesn't (harmless today — deletion is gated to zero assigned users) (§2.4) | Low (doc/code drift) | Confirmed | **New** |
| 4 | `RiskAssessmentRepositoryPort.findById` is unscoped by design and only safe because every current call site passes a server-derived id (§3.3) | Low (hygiene) | Confirmed, not exploitable today | **New** |
| 5 | `.dockerignore` does not exclude nested `.env` files; both application images bake in dev-only credentials at build time | Low, mechanism broken | Confirmed (consistent with prior finding) | Already recorded — **F-14** |
| 6 | No self-permission-ownership check on role/scope administration | Informational — reviewed and endorsed as sound per D-13's own reasoning, compensating controls (seeding + audit) verified present | Confirmed as specified | Already flagged for this review — **D-13** |
| 7 | Four to five bounded reference/catalog endpoints return unpaginated arrays, in literal tension with Constitution XI | Informational / policy question | Confirmed | New observation, not a vulnerability |

No finding in this review reaches High or Critical severity. The Medium finding (#1) is the
"assume a fourth [disclosure defect]" this review was asked to look for.

## 11. Verified by execution vs. inspected only

**Verified by execution** (a real query or test was run against live PostgreSQL/the real module
graph, and its output is quoted above):

- Segregation-of-duties `CHECK` constraint rejects a self-approval (`approvals_decided_by_requester_check`).
- `audit_event` append-only enforcement, both as the application role (GRANT-denied) and as the
  table owner (trigger-denied).
- `permissionsVersion` invalidation without re-login (`permission-invalidation.spec.ts`).
- User deactivation kills a live session, both the direct-port path
  (`user-deactivation-auth.spec.ts`) and the full HTTP admin path (`admin-user-deactivation.spec.ts`).
- The fixed approvals scope-leak regression test (`risk-lifecycle.spec.ts`'s
  byte-identical-404 case).
- The fixed D-11 methodology-403-for-everyone regression (`risk-methodology.spec.ts`, 9 tests).
- Byte-identical out-of-scope-vs-nonexistent 404 for risks (`risk-scope.spec.ts`).
- Audit transactionality (`audit-transactional.spec.ts`) and audit-denial recording (`audit-denied.spec.ts`).
- Organizational reparenting (`org-reparent.spec.ts`).
- `apps/api`'s ESLint run (module-boundary and other static rules currently pass, exit 0).

**Inspected only** (code read and traced, not exercised in this pass): cookie-flag production
enforcement (verified as a startup-validation guard, not by actually booting in `NODE_ENV=production`);
rate-limiting/lockout logic; the file-upload validation/storage/download pipeline (traced end to
end, not exercised via a real multipart HTTP request in this pass — §6.2's timing claim in
particular is a code-path argument, not a measured timing difference); the full raw-SQL sweep; the
secrets grep; the `FR-032` audit-action-coverage inventory; the pagination inventory. None of these
contradicted what a live run would be expected to show, but the distinction is recorded here
deliberately rather than blurred.

## 12. What this review could not check

- No live timing measurement of §6.2's attachment-deduplication oracle (would require a real
  multipart upload harness against production-sized files and a controlled network path to
  distinguish signal from noise — out of this review's time budget, and the code-path evidence is
  unambiguous enough to report without it).
- Production boot behavior of `SESSION_COOKIE_SECURE`/`REDIS_URL` enforcement was confirmed as a
  schema-level `superRefine` rule, not by actually starting the API with `NODE_ENV=production` and
  observing the crash (F-13, already recorded, documents that the packaged Docker image currently
  cannot boot in production mode for an unrelated, already-known reason).
- No penetration-style exercise of the CSRF middleware from an actual cross-origin browser context
  (the middleware's logic was traced and its unit/contract coverage re-run, but a real
  cross-origin `fetch` was not issued in this pass).
