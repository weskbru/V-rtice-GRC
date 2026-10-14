# Phase 1 Data Model

**Feature**: GRC Platform Foundation and Risk Management
**Date**: 2026-09-04
**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Spec**: [spec.md](./spec.md)

Target: PostgreSQL 17 via Prisma. Conventions follow [ADR-008](./research.md#adr-008-explicit-relational-modeling-enums-for-closed-sets-tables-for-configurable-ones):
explicit relations, `NOT NULL` by default, deliberate `ON DELETE` behavior, enums for closed
platform-defined sets, reference tables for organization-configurable sets, no EAV.

**Shared conventions**

- Primary keys are UUIDv7 (`id`), time-ordered so index locality holds as tables grow.
- Every table carries `createdAt` and `updatedAt` (`timestamptz`, UTC).
- Money-free domain; all dates that carry business meaning are `date`, all instants are `timestamptz`.
- `ON DELETE RESTRICT` is the default for anything historically relevant (Constitution V); `CASCADE`
  is used only where the child has no independent meaning and no audit relevance.
- Immutable tables (marked **append-only**) have no update path in the application and, for
  `audit_event`, no update privilege in the database.

---

## 1. Core — Identity and Authentication

### `User`

The internal platform identity. The only identity any business module references ([ADR-001](./research.md#adr-001-provider-agnostic-authentication)).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | uuid | PK | |
| `email` | citext | **unique**, not null | Login identifier and contact |
| `fullName` | text | not null | |
| `jobTitle` | text | nullable | |
| `status` | `UserStatus` | not null, default `ACTIVE` | `ACTIVE` \| `INACTIVE` |
| `primaryOrgUnitId` | uuid | FK → `OrganizationalUnit`, restrict, nullable | The user's own placement |
| `lastLoginAt` | timestamptz | nullable | |
| `createdAt` / `updatedAt` | timestamptz | not null | |

Relations: `LocalCredential?`, `ExternalIdentity[]`, `UserRole[]`, `OrgScopeGrant[]`, `Session[]`.

**Rules**: FR-011 — a user whose `status` is `INACTIVE` cannot authenticate and all their sessions are
revoked at the moment of deactivation (FR-017). Deactivation never deletes the row: audit entries,
assessments and decisions reference it permanently.

### `LocalCredential`

Separated from `User` so federated users carry no meaningless null secret ([ADR-001](./research.md#adr-001-provider-agnostic-authentication)).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `userId` | uuid | FK → `User`, **unique**, cascade |
| `passwordHash` | text | not null — argon2id encoded string |
| `passwordChangedAt` | timestamptz | not null |
| `mustChangePassword` | boolean | not null, default `false` |
| `failedAttempts` | int | not null, default 0 |
| `lockedUntil` | timestamptz | nullable |

**Rules**: FR-005 — never serialized into any DTO, log or audit payload. FR-006 — policy (length,
complexity) validated in the domain before hashing. FR-008 — `failedAttempts`/`lockedUntil` back
per-account throttling; per-origin throttling uses Redis.

### `ExternalIdentity`

Present now so federated providers are additive later; unused in this release.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `userId` | uuid | FK → `User`, cascade |
| `method` | `AuthenticationMethod` | not null |
| `externalSubject` | text | not null |
| `lastSyncedAt` | timestamptz | nullable |

**Unique**: `(method, externalSubject)`.

`enum AuthenticationMethod { LOCAL, LDAP, ACTIVE_DIRECTORY, OIDC, SAML }`
`enum UserStatus { ACTIVE, INACTIVE }`

---

## 2. Core — Sessions

### `Session`

PostgreSQL is authoritative; Redis mirrors active sessions as a validation cache ([ADR-002](./research.md#adr-002-server-side-opaque-sessions-not-jwt)).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | uuid | PK | Never sent to the client |
| `tokenHash` | text | **unique**, not null | SHA-256 of the cookie value; the raw value is never stored |
| `userId` | uuid | FK → `User`, restrict | |
| `authenticationMethod` | `AuthenticationMethod` | not null | FR-013 |
| `createdAt` | timestamptz | not null | |
| `expiresAt` | timestamptz | not null | Absolute lifetime |
| `lastActivityAt` | timestamptz | not null | Written at most once per minute |
| `ipAddress` | inet | nullable | |
| `userAgent` | text | nullable | |
| `revokedAt` | timestamptz | nullable | |
| `revokedReason` | `SessionRevocationReason` | nullable | `LOGOUT` \| `EXPIRED` \| `ADMIN_REVOKED` \| `USER_DEACTIVATED` \| `PASSWORD_CHANGED` |

**Indexes**: `(userId, revokedAt)` for bulk revocation and future self-service session management
(FR-020); `(expiresAt)` for cleanup.

**Rules**: FR-015 — a session with `revokedAt` set or `expiresAt` passed is refused. FR-018 — creation,
expiry, revocation and logout each write an audit event. Storing only `tokenHash` means a database
disclosure does not yield usable sessions.

---

## 3. Core — Authorization

### `Permission`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `identifier` | text | **unique**, not null — `resource:action` |
| `resource` | text | not null |
| `action` | `PermissionAction` | not null |
| `description` | text | not null |

`enum PermissionAction { VIEW, CREATE, EDIT, DELETE, APPROVE, ADMINISTER, ASSESS, TREAT, TRANSITION }`

Seeded set (FR-022): `risk:view`, `risk:create`, `risk:edit`, `risk:assess`, `risk:treat`,
`risk:transition`, `risk:approve`, `risk:administer`, `audit:view`, `user:administer`,
`role:administer`, `org_unit:administer`, `methodology:administer`, `attachment:create`,
`attachment:delete`, `comment:create`, `comment:delete`. A future module seeds its own rows — no schema
change ([ADR-003](./research.md#adr-003-rbac-with-resourceaction-permissions-and-one-decision-path)).

**No `risk:delete` is seeded.** FR-102 forbids hard-deleting a risk, and archival is gated by
`risk:administer`, so a `risk:delete` row would grant nothing and would misrepresent the platform's
capabilities to an administrator reading the role editor. `PermissionAction.DELETE` remains in the enum
as FR-022 requires, and is genuinely exercised by `attachment:delete` and `comment:delete`.

**Requesting an approval-gated transition requires `risk:transition`; deciding it requires
`risk:approve`** — the two are deliberately distinct so `risk:approve` can be granted narrowly
([ADR-006](./research.md#adr-006-risk-calculation-and-lifecycle-owned-by-the-domain)).

### Risk detail section visibility (FR-094)

Reading a risk requires `risk:view` plus organizational scope; that single check admits the record.
Section visibility beyond it is therefore deliberately narrow — only one section carries an additional
read gate, and the remaining permissions gate *actions within* a section, not the section itself.

| Section | Visible when | Actions inside gated by |
|---------|--------------|--------------------------|
| Overview | `risk:view` | `risk:edit` |
| Assessment | `risk:view` | `risk:assess` |
| Causes and Consequences | `risk:view` | `risk:edit` |
| Controls | `risk:view` | `risk:treat` |
| Treatment | `risk:view` | `risk:treat` |
| Action Plans | `risk:view` | `risk:treat` |
| History | `risk:view` | read-only |
| **Audit** | `risk:view` **and `audit:view`** | read-only |
| Attachments | `risk:view` | `attachment:create`, `attachment:delete` |
| Comments | `risk:view` | `comment:create`, `comment:delete` |

A section the user may not see is omitted from the response, not returned empty, so its existence is
not disclosed (FR-030). Lifecycle actions in the header are gated separately by `risk:transition`,
`risk:approve` and `risk:administer` per the transition table.

### `Role` / `RolePermission` / `UserRole`

| `Role` | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `name` | text | **unique**, not null |
| `description` | text | not null |
| `isSystem` | boolean | not null, default `false` — system roles cannot be deleted |

`RolePermission`: `(roleId, permissionId)` composite PK, both FK restrict.
`UserRole`: `(userId, roleId)` composite PK, `grantedByUserId` FK restrict, `grantedAt` not null.

**Seeded roles**: `Platform Administrator`, `Risk Manager`, `Risk Analyst`, `Risk Approver`,
`Auditor` (read plus `audit:view`, global scope), `Read Only`.

**Rules**: FR-028 — a change to any of these three tables increments a `permissionsVersion` counter for
affected users, invalidating the Redis permission cache so the change applies to the next request.
FR-029a — `Risk Analyst` and `Risk Approver` are distinct roles so segregation of duties is
administrable.

---

## 4. Core — Organizations

### `OrganizationalUnit`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | uuid | PK | |
| `code` | text | **unique**, not null | Human-readable |
| `name` | text | not null | |
| `parentId` | uuid | FK → self, restrict, nullable | Null = root |
| `path` | text | not null | Materialized `/{id}/{id}/...` ([ADR-004](./research.md#adr-004-organizational-scope-by-materialized-path-applied-in-the-repository)) |
| `depth` | int | not null | |
| `status` | `OrgUnitStatus` | not null, default `ACTIVE` | `ACTIVE` \| `INACTIVE` |

**Indexes**: `path` with `text_pattern_ops` (prefix scans), `(parentId)`.

**Rules**: `path` is maintained inside the same transaction as any insert or reparent, with the subtree
updated and the change audited. Reparenting is refused if it would create a cycle. A unit with
dependent risks or users cannot be deleted (restrict) — it is deactivated.

### `OrgScopeGrant`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `userId` | uuid | FK → `User`, cascade |
| `scopeType` | `OrgScopeType` | not null — `UNIT` \| `GLOBAL` |
| `orgUnitId` | uuid | FK → `OrganizationalUnit`, restrict, nullable |
| `grantedByUserId` | uuid | FK → `User`, restrict |
| `grantedAt` | timestamptz | not null |

**Check**: `(scopeType = 'GLOBAL' AND orgUnitId IS NULL) OR (scopeType = 'UNIT' AND orgUnitId IS NOT NULL)`.

**Rules**: FR-025a — a `GLOBAL` grant is explicit and audited, never implied. FR-025b — a `UNIT` grant
covers that unit and all descendants, resolved by path prefix. `ScopeResolver` output is cached in
Redis keyed by `userId:orgTreeVersion:grantsVersion`.

---

## 5. Core — Audit

### `audit_event` — **append-only**

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | uuid | PK | |
| `occurredAt` | timestamptz | not null | Partition key |
| `actorUserId` | uuid | FK → `User`, restrict, nullable | Null only for pre-authentication events |
| `actorLabel` | text | not null | Denormalized display name, so history reads correctly after a rename |
| `action` | text | not null | Business action, e.g. `risk.accepted` — never a table name |
| `entityType` | `AuditEntityType` | not null | |
| `entityId` | uuid | nullable | |
| `previousValues` | jsonb | nullable | Allow-listed fields only |
| `newValues` | jsonb | nullable | Allow-listed fields only |
| `organizationalUnitId` | uuid | FK, restrict, nullable | Enables scoped audit reads |
| `ipAddress` | inet | nullable | |
| `userAgent` | text | nullable | |
| `sessionId` | uuid | nullable | Not an FK — sessions are cleaned up, audit is not |
| `correlationId` | uuid | not null | Ties audit to logs |
| `outcome` | `AuditOutcome` | not null | `SUCCESS` \| `FAILURE` \| `DENIED` |

**Partitioning**: `PARTITION BY RANGE (occurredAt)`, monthly, so retention becomes partition detachment
rather than a mass delete ([ADR-005](./research.md#adr-005-transactional-append-only-audit)).

**Indexes**: `(entityType, entityId, occurredAt DESC)`, `(actorUserId, occurredAt DESC)`,
`(occurredAt DESC)`.

**Enforcement (FR-034)**: the application database role holds `INSERT` and `SELECT` only; a
`BEFORE UPDATE OR DELETE` trigger raises an exception. Both are created by an explicit migration and
asserted by an integration test.

**Rules**: FR-035 — a field allow-list per `entityType` governs what may enter the value payloads;
password hashes, token hashes and session token values are never eligible. FR-033/FR-005 — the audit
insert executes inside the same transaction as the change it records.

---

## 6. Core — Files, Comments, Notifications

### `Attachment`

Polymorphic parent reference — the documented exception under [ADR-008](./research.md#adr-008-explicit-relational-modeling-enums-for-closed-sets-tables-for-configurable-ones), justified because this
capability must serve every future module.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `entityType` | `AttachableEntityType` | not null |
| `entityId` | uuid | not null |
| `fileName` | text | not null — original name, never used as a storage path |
| `contentType` | text | not null — validated against the allow-list and sniffed magic bytes |
| `sizeBytes` | bigint | not null |
| `checksumSha256` | text | not null |
| `storageKey` | text | not null — opaque, generated ([ADR-010](./research.md#adr-010-file-storage-behind-a-port-attachments-served-only-through-authorization)) |
| `uploadedByUserId` | uuid | FK → `User`, restrict |
| `deletedAt` | timestamptz | nullable — withdrawal preserves attribution |
| `deletedByUserId` | uuid | FK → `User`, restrict, nullable |

**Index**: `(entityType, entityId, deletedAt)`.

### `Comment`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `entityType` | `CommentableEntityType` | not null |
| `entityId` | uuid | not null |
| `body` | text | not null — stored raw, rendered as plain text; never interpreted as HTML |
| `authorUserId` | uuid | FK → `User`, restrict |
| `deletedAt` / `deletedByUserId` | | nullable |

### `Notification`

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `recipientUserId` | uuid | FK → `User`, cascade |
| `type` | `NotificationType` | not null |
| `title` / `body` | text | not null |
| `entityType` / `entityId` | | nullable — deep link target |
| `readAt` | timestamptz | nullable |

**Index**: `(recipientUserId, readAt, createdAt DESC)`.

**Rules**: FR-098 — attachment and comment access is authorized against the *parent* record's
permissions and organizational scope; there is no independent access path. FR-100 — addition and
withdrawal are audited.

---

## 7. Risk Management — Configuration

### `RiskMethodology` / `RiskMethodologyVersion` — versions are **append-only**

| `RiskMethodology` | Type | Constraints |
|-------------------|------|-------------|
| `id` | uuid | PK |
| `name` | text | not null |
| `isActive` | boolean | not null — exactly one active, enforced by a partial unique index |

| `RiskMethodologyVersion` | Type | Constraints |
|--------------------------|------|-------------|
| `id` | uuid | PK |
| `methodologyId` | uuid | FK, restrict |
| `versionNumber` | int | not null — unique per methodology |
| `probabilityScale` | jsonb | not null — ordered `[{ value, label, description }]` |
| `impactScale` | jsonb | not null — same shape |
| `matrix` | jsonb | not null — `score` and `level` per (probability, impact) cell |
| `levelBands` | jsonb | not null — ordered `[{ level, minScore, maxScore, colorToken }]` |
| `effectiveFrom` | timestamptz | not null |
| `createdByUserId` | uuid | FK, restrict |

**Rules**: FR-068 — a version row is never updated; a methodology change creates a new version. Every
assessment pins `methodologyVersionId`, so historical results are never rescored. JSONB is appropriate
here (and only here in the risk domain) because the scale shape is genuinely variable across
organizational methodologies; its structure is validated by a schema at the application boundary.
Default seed: a 5×5 matrix with bands low / medium / high / critical.

### `RiskCategory` / `RiskType` / `RiskOrigin`

Organization-configurable reference tables, identical shape: `id`, `code` (**unique**), `name`,
`description`, `sortOrder`, `isActive`. Referenced from `Risk` with `ON DELETE RESTRICT` — reference
data in use is deactivated, never deleted.

---

## 8. Risk Management — The Risk Record

### `Risk`

| Field | Type | Constraints | Requirement |
|-------|------|-------------|-------------|
| `id` | uuid | PK | FR-053 |
| `code` | text | **unique**, not null | FR-054 — human-readable, immutable, e.g. `RSK-2026-0001` |
| `title` | text | not null | |
| `description` | text | not null | |
| `categoryId` | uuid | FK → `RiskCategory`, restrict | |
| `typeId` | uuid | FK → `RiskType`, restrict, nullable | |
| `originId` | uuid | FK → `RiskOrigin`, restrict, nullable | |
| `orgUnitId` | uuid | FK → `OrganizationalUnit`, restrict | FR-025 — the scope predicate |
| `ownerUserId` | uuid | FK → `User`, restrict | Accountable owner |
| `responsibleUserId` | uuid | FK → `User`, restrict, nullable | Day-to-day responsible |
| `status` | `RiskStatus` | not null, default `DRAFT` | FR-079 |
| `currentAssessmentId` | uuid | FK → `RiskAssessment`, restrict, nullable | Pointer to latest |
| `currentTreatmentId` | uuid | FK → `RiskTreatmentDecision`, restrict, nullable | Pointer to latest |
| `inherentScore` / `inherentLevel` | int / `RiskLevel` | nullable | Denormalized from current assessment for filtering and sorting |
| `residualScore` / `residualLevel` | int / `RiskLevel` | nullable | Same |
| `identifiedOn` | date | not null | FR-053 |
| `lastAssessedOn` | date | nullable | |
| `nextReviewOn` | date | nullable | FR-070 |
| `pendingApprovalId` | uuid | FK → `Approval`, restrict, nullable | FR-029c — a condition, not a state |
| `version` | int | not null, default 0 | FR-103 — optimistic lock ([ADR-013](./research.md#adr-013-optimistic-concurrency-on-risks)) |
| `archivedAt` | timestamptz | nullable | FR-102 — never hard-deleted |

**Indexes** (derived from the register's actual access paths, FR-087/FR-088/FR-089):
`(orgUnitId, status)`, `(orgUnitId, residualLevel)`, `(orgUnitId, inherentLevel)`,
`(orgUnitId, nextReviewOn)`, `(ownerUserId)`, `(categoryId)`, `(code)`, and a GIN trigram index over
`code || ' ' || title || ' ' || description` for text search.

**Rules**:

- FR-055 — leaving `DRAFT` requires title, description, category, org unit and owner.
- FR-062 — `inherentScore`/`residualScore`/levels are written **only** by the assessment use case from
  `RiskScoringService` output; no other write path exists and no API accepts them as input. They are a
  denormalization of `currentAssessmentId` maintained in the same transaction, existing solely so the
  register can filter and sort without joining every assessment.
- FR-084 — `CLOSED` and `ARCHIVED` risks reject business-content updates; the check lives in the domain.
- FR-054 — `code` is generated from a per-year sequence and never changes.

`enum RiskStatus { DRAFT, IDENTIFIED, ASSESSED, UNDER_TREATMENT, UNDER_REVIEW, ACCEPTED, CLOSED, ARCHIVED }`
`enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }`

### `RiskCause` / `RiskConsequence`

Individually recorded rows, not free-text blobs (FR-057, Constitution I).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, cascade |
| `description` | text | not null |
| `sortOrder` | int | not null |

`CASCADE` is correct here: a cause has no meaning apart from its risk, and its lifecycle changes are
carried by `audit_event`.

---

## 9. Risk Management — Assessment

### `RiskAssessment` — **append-only**

The heart of FR-064 to FR-068 and Constitution VI.

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, restrict |
| `methodologyVersionId` | uuid | FK → `RiskMethodologyVersion`, restrict |
| `assessedByUserId` | uuid | FK → `User`, restrict |
| `assessedOn` | date | not null |
| `inherentProbability` | int | not null, `CHECK` within scale bounds |
| `inherentImpact` | int | not null, `CHECK` within scale bounds |
| `inherentScore` | int | not null — derived |
| `inherentLevel` | `RiskLevel` | not null — derived |
| `residualProbability` | int | not null, `CHECK` |
| `residualImpact` | int | not null, `CHECK` |
| `residualScore` | int | not null — derived |
| `residualLevel` | `RiskLevel` | not null — derived |
| `controlsConsidered` | uuid[] | not null — control ids at assessment time |
| `rationale` | text | nullable |
| `previousAssessmentId` | uuid | FK → self, restrict, nullable | Chain for level-change comparison |

**Index**: `(riskId, assessedOn DESC)`.

**Rules**:

- No update path exists. Reassessment inserts a new row, links `previousAssessmentId`, and repoints
  `Risk.currentAssessmentId` in the same transaction (FR-065).
- Derived columns come exclusively from `RiskScoringService` (FR-062, FR-063). The API rejects any
  request supplying them.
- `methodologyVersionId` pins interpretation, so a later matrix change cannot rescore history (FR-068).
- A reassessment producing an identical level still creates a row (edge case).
- `controlsConsidered` is a snapshot array, deliberately not an FK set: it must record what was true at
  assessment time even if a control link is later removed.

---

## 10. Risk Management — Treatment, Actions and Controls

### `RiskTreatmentDecision` — **append-only**

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, restrict |
| `strategy` | `TreatmentStrategy` | not null |
| `description` | text | not null — rationale (FR-072) |
| `deadline` | date | nullable |
| `decidedByUserId` | uuid | FK → `User`, restrict |
| `decidedAt` | timestamptz | not null |
| `supersededAt` | timestamptz | nullable |
| `supersededById` | uuid | FK → self, restrict, nullable |

`enum TreatmentStrategy { MITIGATE, AVOID, TRANSFER, ACCEPT }`

**Rules**: FR-073 — a new decision stamps `supersededAt` on the previous one rather than overwriting it.

### `RiskTreatmentAction`

Risk-owned in this release, shaped for a future shared Action Plans module ([ADR-007](./research.md#adr-007-historical-data-as-append-only-domain-records), FR-074c).

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, restrict |
| `treatmentDecisionId` | uuid | FK, restrict, nullable |
| `title` / `description` | text | not null / nullable |
| `responsibleUserId` | uuid | FK → `User`, restrict |
| `dueOn` | date | not null |
| `status` | `TreatmentActionStatus` | not null, default `OPEN` |
| `completedAt` | timestamptz | nullable |

`enum TreatmentActionStatus { OPEN, IN_PROGRESS, COMPLETED, CANCELLED }`

**Index**: `(riskId, status)`, `(responsibleUserId, dueOn)`, `(dueOn, status)` for the dashboard's
overdue tile.

**Rules**: FR-074b — overdue means `dueOn < current_date AND status NOT IN (COMPLETED, CANCELLED)`,
computed on read, never stored ([ADR-015](./research.md#adr-015-no-asynchronous-infrastructure-in-this-release)). FR-074c — the only risk-specific column is `riskId`;
migrating to a shared module means adding a polymorphic parent and backfilling one column.

### `Control` and `RiskControlLink`

A minimal control registry — enough to be referenced, deliberately not a Controls Management module
(spec Out of Scope, FR-077).

| `Control` | Type | Constraints |
|-----------|------|-------------|
| `id` | uuid | PK |
| `code` | text | **unique**, not null |
| `name` / `description` | text | not null / nullable |
| `orgUnitId` | uuid | FK, restrict, nullable |
| `isActive` | boolean | not null, default `true` |

| `RiskControlLink` | Type | Constraints |
|-------------------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, restrict |
| `controlId` | uuid | FK → `Control`, restrict |
| `linkedByUserId` | uuid | FK → `User`, restrict |
| `linkedAt` | timestamptz | not null |
| `unlinkedAt` / `unlinkedByUserId` | | nullable — withdrawal preserves history |

**Partial unique**: `(riskId, controlId) WHERE unlinkedAt IS NULL`.

**Rules**: FR-077 — the link is a named entity carrying its own facts, so a future Controls module can
take ownership of `Control` without changing the relationship's meaning or migrating risk data.

### `RiskProcessLink` / `RiskAssetLink`

Same shape as `RiskControlLink` against minimal `Process` and `Asset` reference tables (`id`, `code`,
`name`, `orgUnitId`, `isActive`). Explicit named relations, not a generic mechanism — the planning input
requires explicit relationships where the business meaning is known. Relationships to incidents,
problems, compliance requirements and audits are **not** created now (FR-112): they will be new link
tables, which is additive.

---

## 11. Risk Management — Lifecycle and Approvals

### `RiskLifecycleTransition` — **append-only**

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `riskId` | uuid | FK → `Risk`, restrict |
| `fromStatus` | `RiskStatus` | not null |
| `toStatus` | `RiskStatus` | not null |
| `performedByUserId` | uuid | FK → `User`, restrict |
| `performedAt` | timestamptz | not null |
| `justification` | text | nullable |
| `approvalId` | uuid | FK → `Approval`, restrict, nullable |

**Index**: `(riskId, performedAt DESC)`.

### `Approval` — decision fields written once

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | uuid | PK |
| `entityType` | `ApprovableEntityType` | not null — `RISK` today |
| `entityId` | uuid | not null |
| `requestedTransition` | text | not null — e.g. `UNDER_TREATMENT->ACCEPTED` |
| `requestedByUserId` | uuid | FK → `User`, restrict |
| `requestedAt` | timestamptz | not null |
| `status` | `ApprovalStatus` | not null, default `PENDING` |
| `decidedByUserId` | uuid | FK → `User`, restrict, nullable |
| `decidedAt` | timestamptz | nullable |
| `justification` | text | nullable |

`enum ApprovalStatus { PENDING, APPROVED, REJECTED }`

**Check (FR-029a)**: `decidedByUserId IS NULL OR decidedByUserId <> requestedByUserId` — a database
backstop to the domain rule, so segregation of duties holds even if a future code path forgets it.

**Partial unique**: one `PENDING` approval per `(entityType, entityId)`.

**Index**: `(status, entityType, entityId)` for the dashboard's pending-approvals tile.

### State machine (FR-079 to FR-085)

```text
                        ┌──────────────────────────────────────────┐
                        ▼                                          │
  DRAFT ──▶ IDENTIFIED ──▶ ASSESSED ──▶ UNDER_TREATMENT ──▶ UNDER_REVIEW
                             │  │            │  │                │
                             │  └────────────┼──┴────────────────┤
                             │               │                   │
                             ▼               ▼                   ▼
                          ACCEPTED ◀═════════╪═══════════════════╡   ═══▶ requires approval
                             │               │                   │
                             ▼               ▼                   ▼
                          CLOSED ◀═══════════╧═══════════════════╛
                             │
                             ▼
                          ARCHIVED
```

The authoritative transition table — permission, preconditions and approval requirement per transition
— is in [ADR-006](./research.md#adr-006-risk-calculation-and-lifecycle-owned-by-the-domain). Any pair absent from it is refused (FR-081). `UNDER_REVIEW → ASSESSED`
is the reassessment return path. Transitions into `ACCEPTED` and `CLOSED` require an approval by a
different user (FR-029, FR-029a).

---

## 12. Entity relationship overview

```text
OrganizationalUnit ──┬─◀ User ──┬─◀ LocalCredential
   (self-parent,     │          ├─◀ ExternalIdentity
    materialized     │          ├─◀ Session
    path)            │          ├─◀ UserRole ──▶ Role ──◀ RolePermission ──▶ Permission
                     │          └─◀ OrgScopeGrant
                     │
                     └─◀ Risk ──┬─◀ RiskCause
                                ├─◀ RiskConsequence
                                ├─◀ RiskAssessment ──▶ RiskMethodologyVersion ──▶ RiskMethodology
                                │      (append-only, self-chained)
                                ├─◀ RiskTreatmentDecision (append-only, self-superseded)
                                ├─◀ RiskTreatmentAction
                                ├─◀ RiskControlLink ──▶ Control
                                ├─◀ RiskProcessLink ──▶ Process
                                ├─◀ RiskAssetLink   ──▶ Asset
                                ├─◀ RiskLifecycleTransition (append-only) ──▶ Approval
                                └─▶ RiskCategory / RiskType / RiskOrigin

audit_event (append-only, monthly partitions) ──▶ User (actor), OrganizationalUnit
Attachment / Comment / Notification ──(entityType, entityId)──▶ any participating entity
```

---

## 13. Requirement coverage

| Requirement group | Where satisfied |
|-------------------|-----------------|
| FR-001–FR-011 identity | `User`, `LocalCredential`, `ExternalIdentity` |
| FR-012–FR-020 sessions | `Session` |
| FR-021–FR-030 authorization, scope, SoD | `Permission`, `Role`, `UserRole`, `OrgScopeGrant`, `Approval` check constraint |
| FR-031–FR-038 audit | `audit_event` with partitioning, privilege revocation and trigger |
| FR-047–FR-052 dashboard | Aggregates over `Risk`, `RiskTreatmentAction`, `Approval` — no new tables |
| FR-053–FR-060 risk record | `Risk`, `RiskCause`, `RiskConsequence`, reference tables |
| FR-061–FR-070 methodology and assessment | `RiskMethodology`, `RiskMethodologyVersion`, `RiskAssessment` |
| FR-071–FR-078 treatment and controls | `RiskTreatmentDecision`, `RiskTreatmentAction`, `Control`, `RiskControlLink` |
| FR-079–FR-085 lifecycle | `Risk.status`, `RiskLifecycleTransition`, `Approval` |
| FR-086–FR-094 register and detail | `Risk` indexes and the trigram search index |
| FR-095–FR-101 comments, attachments, notifications | `Comment`, `Attachment`, `Notification` |
| FR-102–FR-105 integrity and history | Append-only tables, `archivedAt`, `deletedAt`, `Risk.version` |
| FR-110–FR-112 extensibility | Polymorphic comment/attachment/approval entity types; named link tables |

## 14. Migration and seed policy

Migrations are Prisma-generated, reviewed, forward-only, and additive by default (Constitution XV). A
destructive migration requires explicit approval and a data-preservation plan. Raw SQL migrations are
required for four things Prisma cannot express: `audit_event` partitioning, the append-only trigger and
privilege grants, the trigram search index, and the partial unique indexes.

Seed data: permissions, system roles, a root organizational unit, the default 5×5 methodology version,
starter risk categories/types/origins, and one administrator account whose password must be changed on
first sign-in (`LocalCredential.mustChangePassword = true`). No seed contains a real secret.
