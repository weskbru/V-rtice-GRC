# Phase 1 API Contracts

**Feature**: GRC Platform Foundation and Risk Management
**Date**: 2026-09-04
**Plan**: [../plan.md](../plan.md) · **Research**: [../research.md](../research.md) ·
**Data model**: [../data-model.md](../data-model.md) · **Spec**: [../spec.md](../spec.md)

These four OpenAPI 3.1 documents are the explicit REST contracts for this release, governed by
[ADR-009](../research.md#adr-009-rest-contracts--versioned-dto-bounded-problemjson-offset-pagination)
and Constitution XIII. They are **the machine-readable source of truth for `packages/api-types`**,
which is generated from them (see D-14 in `docs/local-environment.md`).

This reverses an earlier plan, recorded here for anyone who remembers it: `apps/api/openapi.json` was
to be that source. It cannot be. It is produced by reflecting NestJS decorators, and because no DTO in
this codebase carries `@ApiProperty`, every one of its component schemas is
`{"type":"object","properties":{}}` — it describes which routes exist and not one field of any of them
(finding F-3). `openapi.json` and its `openapi:check` gate remain valuable and remain in CI, but for
what they actually are: a **route-level** drift detector, which catches an added, removed or renamed
route and cannot see a renamed or retyped DTO field.

Each file is standalone. The small number of shared schemas — `Problem`, `FieldError`, `PageMeta`,
`UserRef`, `OrgUnitRef` — is repeated in each document rather than cross-referenced, so any file can
be opened, validated or reviewed on its own.

## Files

| File | Surface | Operations |
|------|---------|-----------:|
| [`auth.openapi.yaml`](./auth.openapi.yaml) | Sign-in, sign-out, current session, own profile, own-password change | 5 |
| [`admin.openapi.yaml`](./admin.openapi.yaml) | Users, roles, permissions, organizational units, organizational scope grants, plus two non-administrative directory lookups | 24 |
| [`risks.openapi.yaml`](./risks.openapi.yaml) | Risk record and register, assessments, treatment and actions, control/process/asset links, lifecycle, approvals, history, per-risk audit | 27 |
| [`platform.openapi.yaml`](./platform.openapi.yaml) | Comments, attachments, notifications, dashboard, health, risk methodology, reference data | 22 |
| | **Total** | **78** |

## Shared conventions

### Base path and versioning

All paths are relative to `/api/v1`. Additive changes ship in `v1`; a breaking change opens `v2`
with `v1` retained through a deprecation window (ADR-009, Constitution XV). The browser reaches a
single origin — Next.js proxies `/api/*` to the API — so cookies are first-party and no CORS
configuration exists (ADR-014).

### Authentication

Cookie-based server-side sessions (ADR-002). Every document declares one security scheme:

```yaml
securitySchemes:
  session:
    type: apiKey
    in: cookie
    name: pgrc_session
```

The cookie is `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, carrying a 256-bit opaque identifier.
It is unreadable by client script (FR-019) and the internal `Session.id` is never returned in any
response (FR-107).

Each document applies `security: [{ session: [] }]` at the root, so **every operation is
authenticated by default**. Exactly three operations opt out with an explicit `security: []`:

| Public operation | Why |
|------------------|-----|
| `POST /auth/login` | There is no session yet (FR-003) |
| `GET /health/live` | Liveness probe; exposes no detail (ADR-012) |
| `GET /health/ready` | Readiness probe; exposes no detail (ADR-012) |

Every state-changing request must present an `Origin` (or `Referer`) header matching the deployment
origin. Requests that do not are refused with `403`; combined with `SameSite=Lax` this is the CSRF
defence (FR-019, ADR-002).

Session revocation and expiry take effect on the next request: a revoked, expired or
deactivated-user session yields `401` everywhere (FR-015, FR-017).

### Authorization

Every operation's `description` names the permission it requires, in the form
"Requires `risk:approve`." Permissions are the stable `resource:action` identifiers of ADR-003,
checked by one `@RequirePermission` decorator and one global guard. The permission set returned by
`GET /auth/session` exists so the interface can hide controls; it is **advisory only** and every
decision is re-evaluated on the server (FR-026).

Permission by endpoint group:

| Group | Permission required |
|-------|---------------------|
| `/auth/*` | Authenticated session only |
| `/users`, `/org-units` (directory lookups) | Authenticated session only |
| `/admin/users/*`, `/admin/users/{id}/scope-grants/*` | `user:administer` |
| `/admin/users/{id}/roles`, `/admin/roles/*`, `/admin/permissions` | `role:administer` |
| `/admin/org-units/*` | `org_unit:administer` |
| `GET /risks*`, `GET /risks/{id}/*` | `risk:view` |
| `POST /risks` | `risk:create` |
| `PATCH /risks/{id}`, causes, consequences, process and asset links | `risk:edit` |
| `POST /risks/{id}/assessments` | `risk:assess` |
| Treatment decisions, treatment actions, control links | `risk:treat` |
| `POST /risks/{id}/transitions`, `POST /risks/{id}/approvals` | Per the transition table — `risk:edit`, `risk:assess`, `risk:treat`, `risk:transition` or `risk:administer` (ADR-006) |
| `POST /risks/{id}/approvals/{id}/decision` | `risk:approve` |
| `GET /risks/{id}/audit-events` | `audit:view` **and** `risk:view` |
| `POST /comments` / `DELETE /comments/{id}` | `comment:create` / `comment:delete`, **plus** view of the parent record |
| `POST /attachments` / `DELETE /attachments/{id}` | `attachment:create` / `attachment:delete`, **plus** view of the parent record |
| `GET /attachments/{id}/content`, `GET /comments`, `GET /attachments` | View permission and scope of the **parent record** (FR-098) |
| `POST /risk-methodology/versions` | `methodology:administer` |
| `GET /controls`, `/processes`, `/assets` | `risk:view` |
| `GET /risk-categories`, `/risk-types`, `/risk-origins`, `/risk-methodology*` | Authenticated session only |
| `/notifications*`, `/dashboard` | Authenticated session only; contents are scoped to the caller |

### Organizational scope, and why unauthorized reads return 404

Every read and write of a risk and its related records carries a mandatory organizational-scope
predicate applied in the repository layer (FR-025, ADR-004). A `UNIT` grant covers that unit and all
its descendants; a `GLOBAL` grant is explicit and audited, never implied (FR-025a, FR-025b).

**Authorization failures on records the caller may not see return `404`, not `403` (FR-030).** This
is deliberate and applies uniformly:

- A risk outside the caller's authorized organizational scope → `404`.
- A risk the caller has no `risk:view` permission for → `404`.
- A comment, attachment or attachment download whose parent record the caller may not see → `404`
  (FR-098).
- A notification addressed to another user → `404`.

`403` is used only where the caller demonstrably already knows the record exists, so the distinction
discloses nothing:

- The caller can view the risk but lacks the permission for the specific action — for example
  `audit:view` on `GET /risks/{riskId}/audit-events`, or `risk:approve` on an approval decision.
- The caller lacks an administrative permission on a non-scoped resource under `/admin`.
- The cross-site request forgery origin check failed.

Refusals that are security-relevant are themselves audited with outcome `DENIED` (FR-037).

### Errors — RFC 9457 `application/problem+json`

One error shape across the whole API, defined once per document as the `Problem` schema:

```json
{
  "type": "/problems/version-conflict",
  "title": "The risk was modified by another user",
  "status": 409,
  "detail": "Reload the risk and reapply your changes.",
  "instance": "/api/v1/risks/0193c1f6-0000-7000-8000-000000000001",
  "correlationId": "0193c1f6-8c1a-7b6c-9f27-3f2b0a5b6d11",
  "errors": [{ "field": "residualImpact", "code": "out_of_scale", "message": "..." }]
}
```

`correlationId` ties the response to the structured log entry for the same request (ADR-012). No
stack trace, SQL fragment, storage key or other internal identifier ever appears in `detail`
(FR-107, SC-010).

| Status | When it is used |
|--------|-----------------|
| `400` | Malformed request, unknown property — including any attempt to supply a derived score or level — or a missing required header such as `If-Match` (FR-062, FR-106) |
| `401` | No session, or an expired or revoked one (FR-015). Also the generic sign-in failure (FR-007) |
| `403` | Caller can see the record but lacks the permission for this action; or the CSRF origin check failed |
| `404` | No such resource, **or** a resource the caller may not see — deliberately indistinguishable (FR-030) |
| `409` | Optimistic-locking version conflict (ADR-013), a duplicate that violates a uniqueness rule, or a decision already taken on an approval |
| `413` | Attachment exceeds the configured maximum size (FR-097) |
| `422` | Well-formed request refused by a domain rule: server-side validation, referential integrity, a target unit outside scope, a closed or archived record, an illegal or precondition-failing transition, an out-of-scale assessment factor, or segregation of duties (FR-059, FR-060, FR-025c, FR-067, FR-081, FR-084, FR-029a) |
| `429` | Rate limit exceeded on authentication; the body never discloses whether the account exists (FR-008) |
| `503` | Readiness probe only — a required dependency is unavailable |

### Pagination

Offset pagination on every collection, with a `pageSize` capped at 100 so no endpoint can return an
unbounded set (FR-086, ADR-009):

```
GET /api/v1/risks?page=2&pageSize=50
```

```json
{ "data": [ ... ], "meta": { "page": 2, "pageSize": 50, "total": 1284, "totalPages": 26 } }
```

`total` is required because the register needs a visible count and jump-to-page (US3 AS1). Bounded
collections that cannot grow with the data set — available lifecycle transitions, a risk's current
control links, the permission catalogue, the organizational unit tree, reference data — are returned
as plain arrays.

### Optimistic locking on risks

`GET /risks/{riskId}` returns the risk's `version` as an `ETag` (for example `"7"`). **Every**
mutation of a risk or of a risk-owned child requires that value in an `If-Match` request header
(ADR-013, FR-103):

- Missing or malformed header → `400`.
- Stale version → `409` with a `VersionConflictProblem`, which extends `Problem` with
  `currentVersion`, `currentStatus`, `modifiedAt` and `modifiedBy`. **Nothing is written**;
  last-write-wins never occurs.
- Success → the response carries the new `ETag`.

Because lifecycle transitions and approval decisions use the same mechanism, two concurrent
transition requests cannot both apply — exactly one succeeds and the other receives `409` with the
current state (FR-085).

### Derived values are read-only

`inherentScore`, `inherentLevel`, `residualScore` and `residualLevel` are computed exclusively by
`RiskScoringService` from an assessment's factor values and its pinned methodology version. They are
marked `readOnly: true` wherever they appear and **no request body in any of these documents accepts
them**; every write DTO sets `additionalProperties: false`, so a client that sends one receives
`400` (FR-062, FR-063, ADR-006).

Assessment creation accepts only `inherentProbability`, `inherentImpact`, `residualProbability`,
`residualImpact`, the controls considered, an optional rationale, an optional assessment date, an
optional next review date, and the methodology version the client scored against.

### Register filters and sorting

`GET /risks` exposes the complete filter and sort surface the specification requires:

| Capability | Parameters | Requirement |
|------------|-----------|-------------|
| Text search over code, title and description | `q` | FR-089 |
| Status | `status` (multi) | FR-088 |
| Risk level | `riskLevel` (multi), `riskLevelBasis` (`RESIDUAL` default, or `INHERENT`) | FR-088 |
| Category | `categoryId` (multi) | FR-088 |
| Organizational unit | `orgUnitId` (multi), `includeDescendants` | FR-088, FR-025b |
| Owner | `ownerUserId` (multi) | FR-088 |
| Overdue review | `overdueReview` | FR-070, FR-091 |
| Overdue treatment | `overdueTreatment` | FR-074b, FR-075 |
| Sorting | `sort` = `code`, `title`, `riskLevel`, `status`, `owner`, `nextReviewOn`, `identifiedOn`, `updatedAt`; `direction` = `asc`/`desc` | FR-087 |
| Pagination | `page`, `pageSize` | FR-086 |

Multi-valued filters are comma-separated (`style: form`, `explode: false`) and combine with AND
across parameters, OR within one. Ordering is always by the requested field with `code` as the
tiebreaker, so paging is stable. `overdueReview` and `overdueTreatment` are reported as separate row
flags, never collapsed into one indicator (edge case "overdue everything"). Filter, search, sort and
page state live in the register's URL query, which is what lets the interface restore them when the
user returns from a risk (FR-092).

### Approvals and segregation of duties

Transitions into `ACCEPTED` and `CLOSED` are approval gated (FR-029) and are **not** available
through `POST /risks/{riskId}/transitions` — that endpoint refuses them with `422`. The flow is:

1. `POST /risks/{riskId}/approvals` opens a `PENDING` approval. The risk **stays in its current
   lifecycle state**; awaiting approval is an explicit condition on the record, not a ninth state
   (FR-029c). Only one approval may be pending per risk; a second attempt is `409`.
2. `POST /risks/{riskId}/approvals/{approvalId}/decision` records `APPROVED` or `REJECTED`.
   **The deciding user must differ from the requesting user.** A caller deciding their own request
   is refused with `422` (`type: /problems/segregation-of-duties`) and the risk does not change
   state, regardless of the permissions held and regardless of the entry point used — the rule lives
   in the domain service with a database check constraint behind it (FR-029a, US6 AS6, SC-016).
   Approval applies the transition in the same transaction; rejection clears the condition and
   records the rejection with actor, timestamp and justification.

### Attachments

Upload is `multipart/form-data` with `entityType`, `entityId` and `file`. Content type is validated
against the configured allow-list and the sniffed magic bytes; size against the configured maximum
(25 MB by default). Disallowed type → `422`; excessive size → `413`; in both cases nothing is stored
(FR-097).

Download is `GET /attachments/{attachmentId}/content` — the only path to stored bytes. It authorizes
against the **parent record** on every request, so a shared URL is not an unauthenticated capability
(FR-098, ADR-010), and always responds with `Content-Disposition: attachment`,
`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'` and
`Cache-Control: private, no-store`, so content can never be interpreted as active content in the
browser (FR-099).

### Deletion

There is deliberately no `DELETE /risks/{riskId}`. Records carrying historical traceability are
never hard-deleted (FR-102): a risk is archived through the lifecycle transition to `ARCHIVED`,
comments and attachments are withdrawn with attribution preserved, control links are withdrawn with
who and when recorded, treatment actions terminate as `CANCELLED`, and audit entries have no
modification or deletion endpoint at all (FR-034). Users, roles in use and organizational units are
deactivated rather than removed.

## Scope boundary

The Problems, Incidents, Controls-as-a-module, Assets-as-a-module, Processes-as-a-module, shared
Action Plans, Compliance, Audits, Indicators and Reports modules are out of scope for this release
and have no endpoints here. `GET /controls`, `GET /processes` and `GET /assets` expose only the
minimal registries needed for a risk to reference them; there is no create, update or delete surface
and no control design, testing or effectiveness capability. The dashboard names problems, incidents
and controls in `plannedAreas` with a status and **no metrics of any kind** (FR-050, SC-013).

## Requirement traceability

Every operation below traces to at least one functional requirement. Requirements not listed here
are satisfied outside the HTTP contract — by the data model, the frontend, logging or the build.

### `auth.openapi.yaml`

| Operation | Endpoint | Requirements |
|-----------|----------|--------------|
| `login` | `POST /auth/login` | FR-001, FR-002, FR-003, FR-005, FR-007, FR-008, FR-011, FR-012, FR-013, FR-018, FR-019 |
| `logout` | `POST /auth/logout` | FR-016, FR-018 |
| `getCurrentSession` | `GET /auth/session` | FR-013, FR-014, FR-015, FR-020, FR-028, FR-040, FR-042 |
| `getOwnProfile` | `GET /auth/me` | FR-005, FR-009 |
| `changeOwnPassword` | `POST /auth/me/password` | FR-006, FR-010, FR-017, FR-035 |

### `admin.openapi.yaml`

| Operation | Endpoint | Requirements |
|-----------|----------|--------------|
| `listDirectoryUsers` | `GET /users` | FR-058, FR-074 |
| `listOrgUnitsInScope` | `GET /org-units` | FR-024, FR-025b, FR-025c |
| `listUsers` | `GET /admin/users` | FR-021, FR-086 |
| `createUser` | `POST /admin/users` | FR-001, FR-005, FR-006, FR-021, FR-023, FR-025a, FR-032 |
| `getUser` | `GET /admin/users/{userId}` | FR-021, FR-023 |
| `updateUser` | `PATCH /admin/users/{userId}` | FR-032, FR-033 |
| `setUserStatus` | `PUT /admin/users/{userId}/status` | FR-011, FR-015, FR-017, FR-032, FR-102 |
| `resetUserPassword` | `PUT /admin/users/{userId}/password` | FR-005, FR-006, FR-017, FR-032 |
| `replaceUserRoles` | `PUT /admin/users/{userId}/roles` | FR-021, FR-023, FR-028, FR-032, FR-033 |
| `revokeUserSessions` | `DELETE /admin/users/{userId}/sessions` | FR-015, FR-018 |
| `listUserScopeGrants` | `GET /admin/users/{userId}/scope-grants` | FR-024, FR-025a |
| `grantUserScope` | `POST /admin/users/{userId}/scope-grants` | FR-024, FR-025, FR-025a, FR-025b, FR-028, FR-032 |
| `revokeUserScope` | `DELETE /admin/users/{userId}/scope-grants/{grantId}` | FR-025, FR-028, FR-032 |
| `listRoles` | `GET /admin/roles` | FR-021, FR-023 |
| `createRole` | `POST /admin/roles` | FR-022, FR-023, FR-032 |
| `getRole` | `GET /admin/roles/{roleId}` | FR-023 |
| `updateRole` | `PATCH /admin/roles/{roleId}` | FR-023, FR-028, FR-032, FR-033 |
| `deleteRole` | `DELETE /admin/roles/{roleId}` | FR-023, FR-032 |
| `listPermissions` | `GET /admin/permissions` | FR-021, FR-022, FR-110 |
| `listOrgUnits` | `GET /admin/org-units` | FR-024 |
| `createOrgUnit` | `POST /admin/org-units` | FR-024, FR-032 |
| `getOrgUnit` | `GET /admin/org-units/{orgUnitId}` | FR-024 |
| `updateOrgUnit` | `PATCH /admin/org-units/{orgUnitId}` | FR-024, FR-025b, FR-032 |
| `setOrgUnitStatus` | `PUT /admin/org-units/{orgUnitId}/status` | FR-024, FR-060, FR-102 |

### `risks.openapi.yaml`

| Operation | Endpoint | Requirements |
|-----------|----------|--------------|
| `listRiskRegister` | `GET /risks` | FR-025, FR-030, FR-070, FR-074b, FR-075, FR-086, FR-087, FR-088, FR-089, FR-090, FR-091, FR-092 |
| `createRisk` | `POST /risks` | FR-025c, FR-053, FR-054, FR-055, FR-056, FR-057, FR-059, FR-060, FR-062, FR-032 |
| `getRisk` | `GET /risks/{riskId}` | FR-025, FR-030, FR-053, FR-069, FR-093, FR-094, FR-103 |
| `updateRisk` | `PATCH /risks/{riskId}` | FR-025c, FR-026, FR-058, FR-059, FR-060, FR-062, FR-084, FR-103, FR-032, FR-033 |
| `replaceRiskCauses` | `PUT /risks/{riskId}/causes` | FR-057, FR-084, FR-103 |
| `replaceRiskConsequences` | `PUT /risks/{riskId}/consequences` | FR-057, FR-084, FR-103 |
| `listRiskAssessments` | `GET /risks/{riskId}/assessments` | FR-064, FR-065, FR-066, FR-068 |
| `createRiskAssessment` | `POST /risks/{riskId}/assessments` | FR-061, FR-062, FR-063, FR-064, FR-065, FR-067, FR-068, FR-070, FR-103 |
| `listRiskTreatmentDecisions` | `GET /risks/{riskId}/treatments` | FR-072, FR-073, FR-105 |
| `createRiskTreatmentDecision` | `POST /risks/{riskId}/treatments` | FR-071, FR-072, FR-073, FR-075, FR-032 |
| `listRiskTreatmentActions` | `GET /risks/{riskId}/treatment-actions` | FR-074, FR-074b |
| `createRiskTreatmentAction` | `POST /risks/{riskId}/treatment-actions` | FR-074, FR-074c, FR-032 |
| `updateRiskTreatmentAction` | `PATCH /risks/{riskId}/treatment-actions/{actionId}` | FR-074, FR-074a, FR-074b, FR-102 |
| `listRiskControlLinks` | `GET /risks/{riskId}/controls` | FR-076, FR-077, FR-078 |
| `linkControlToRisk` | `POST /risks/{riskId}/controls` | FR-076, FR-077, FR-078, FR-032 |
| `unlinkControlFromRisk` | `DELETE /risks/{riskId}/controls/{linkId}` | FR-076, FR-102, FR-032 |
| `linkProcessToRisk` | `POST /risks/{riskId}/processes` | FR-053, FR-060, FR-112 |
| `unlinkProcessFromRisk` | `DELETE /risks/{riskId}/processes/{linkId}` | FR-053, FR-102 |
| `linkAssetToRisk` | `POST /risks/{riskId}/assets` | FR-053, FR-060, FR-112 |
| `unlinkAssetFromRisk` | `DELETE /risks/{riskId}/assets/{linkId}` | FR-053, FR-102 |
| `getRiskLifecycle` | `GET /risks/{riskId}/lifecycle` | FR-029c, FR-079, FR-080, FR-082 |
| `transitionRisk` | `POST /risks/{riskId}/transitions` | FR-079, FR-080, FR-081, FR-083, FR-084, FR-085, FR-102 |
| `listRiskApprovals` | `GET /risks/{riskId}/approvals` | FR-029b, FR-029c, FR-105 |
| `requestRiskApproval` | `POST /risks/{riskId}/approvals` | FR-029, FR-029b, FR-029c, FR-029d, FR-085 |
| `decideRiskApproval` | `POST /risks/{riskId}/approvals/{approvalId}/decision` | FR-029, FR-029a, FR-029b, FR-029c, FR-083, FR-085 |
| `getRiskHistory` | `GET /risks/{riskId}/history` | FR-066, FR-073, FR-102, FR-105 |
| `listRiskAuditEvents` | `GET /risks/{riskId}/audit-events` | FR-030, FR-031, FR-033, FR-034, FR-035, FR-036, FR-037 |

### `platform.openapi.yaml`

| Operation | Endpoint | Requirements |
|-----------|----------|--------------|
| `listComments` | `GET /comments` | FR-095, FR-098, FR-110 |
| `createComment` | `POST /comments` | FR-095, FR-098, FR-100, FR-110 |
| `deleteComment` | `DELETE /comments/{commentId}` | FR-100, FR-102 |
| `listAttachments` | `GET /attachments` | FR-096, FR-098, FR-110 |
| `uploadAttachment` | `POST /attachments` | FR-096, FR-097, FR-100, FR-110 |
| `deleteAttachment` | `DELETE /attachments/{attachmentId}` | FR-100, FR-102 |
| `downloadAttachmentContent` | `GET /attachments/{attachmentId}/content` | FR-030, FR-098, FR-099 |
| `listNotifications` | `GET /notifications` | FR-044, FR-101 |
| `markAllNotificationsRead` | `POST /notifications` | FR-101 |
| `markNotificationRead` | `POST /notifications/{notificationId}/read` | FR-030, FR-101 |
| `getDashboard` | `GET /dashboard` | FR-047, FR-048, FR-049, FR-050, FR-051, FR-052, FR-070, FR-074b |
| `getLiveness` | `GET /health/live` | FR-109 (ADR-012) |
| `getReadiness` | `GET /health/ready` | FR-109 (ADR-012) |
| `getActiveRiskMethodology` | `GET /risk-methodology` | FR-061, FR-063, FR-069 |
| `listRiskMethodologyVersions` | `GET /risk-methodology/versions` | FR-061, FR-068 |
| `createRiskMethodologyVersion` | `POST /risk-methodology/versions` | FR-061, FR-062, FR-068, FR-032 |
| `listRiskCategories` | `GET /risk-categories` | FR-053, FR-060 |
| `listRiskTypes` | `GET /risk-types` | FR-053, FR-060 |
| `listRiskOrigins` | `GET /risk-origins` | FR-053, FR-060 |
| `listControls` | `GET /controls` | FR-076, FR-077 |
| `listProcesses` | `GET /processes` | FR-053 |
| `listAssets` | `GET /assets` | FR-053 |

### Requirements deliberately not represented by an endpoint

| Requirement | Where it is satisfied |
|-------------|----------------------|
| FR-004 | Architecture — the `AuthenticationProvider` port; no contract change when a provider is added (ADR-001) |
| FR-021, FR-026, FR-027 | Cross-cutting: the single `PermissionGuard` behind every operation |
| FR-034 | By omission — no endpoint modifies or deletes an audit entry, plus database privilege revocation and a trigger |
| FR-038, FR-110, FR-111 | Module boundaries and the entity-type registries; `entityType` is an enum a future module extends by seeding |
| FR-039 to FR-046 | Frontend application shell and design system |
| FR-069, FR-091, FR-093, FR-094 | Presentation of contract data; the API supplies distinct inherent and residual values, named levels and structured sections |
| FR-092 | Register filter state is carried in the URL query defined by `GET /risks` |
| FR-104 | Database constraints (data-model.md §14) |
| FR-106 to FR-109 | Global validation pipe, exception filter, redacting logger (ADR-012) |
| FR-112 | Additive link tables; no risk-record restructuring is needed to add them |

## Open points found while writing these contracts

Recorded rather than silently resolved, per Constitution XIV. Items 1, 2, 5 and 6 were **resolved in
architecture review on 2026-09-04**; the resolutions are recorded in plan.md §Post-Design Re-Check.

1. **RESOLVED — `risk:delete` dropped from the seed.** It governed no operation, since FR-102 forbids
   hard-deleting a risk and archival is gated by `risk:administer`. A permission that grants nothing
   would misrepresent the platform's capabilities in the role editor. `PermissionAction.DELETE` remains
   in the enum as FR-022 requires and is exercised by `attachment:delete` and `comment:delete`.
   data-model.md §3 and research.md ADR-003 updated.

2. **RESOLVED — "risk level" means residual by default.** FR-087, FR-088 and FR-091 say "risk level"
   without a basis while the model stores both. The explicit `riskLevelBasis` parameter defaulting to
   `RESIDUAL` is confirmed and recorded in ADR-006: residual is the exposure a risk manager acts on,
   and naming the parameter prevents two readers disagreeing about what a filter meant.

3. **The dashboard's "action plans" area has no stated backing.** FR-048 requires an action-plans
   area; FR-050 lists only problems, incidents and controls as planned/unavailable; the shared
   Action Plans module is out of scope but risk-owned treatment actions exist. These contracts back
   the area with treatment-action counts rather than marking it planned. If it should instead be
   `PLANNED`, FR-050's list needs to name it.

4. **Reference data is read-only over the API.** FR-053 and the data model describe risk categories,
   types and origins as organization-configurable with `sortOrder` and `isActive`, and the same for
   the control, process and asset registries — but no functional requirement describes maintaining
   them, and the seed provides starter values. No create/update endpoints are defined. If customers
   must configure these in this release, that is a specification gap.

5. **RESOLVED — no superseded methodology version is acceptable.** An assessment names the
   `methodologyVersionId` it was prepared against and is refused with `422` if that version is no
   longer the active one. No grace window. A window would require a "which versions are still
   acceptable" rule and would allow two assessments recorded minutes apart under different
   methodologies with nothing explaining why. Refusing costs one re-entry against current scales and is
   always correct. Recorded in ADR-007; the frontend preserves still-valid factor values on reload.

6. **RESOLVED — `risk:transition` to request, `risk:approve` to decide.** ADR-006's transition table
   assigned `risk:approve` to the `ACCEPTED` and `CLOSED` transitions without distinguishing the
   request from the decision, which would have meant every user able to propose acceptance already
   held the permission to grant it — leaving `approver ≠ requester` as the only remaining control, and
   any two approvers able to rubber-stamp each other. The contracts' split is correct and ADR-006 has
   been corrected to match, so an organization can grant `risk:transition` broadly and `risk:approve`
   narrowly. Task T157 updated.

7. **Sessions are not self-manageable, by design.** FR-020 requires the model to support a future
   self-service session list; no endpoint exposes it in this release, and `Session.id` is never
   returned. Administrative revocation is provided by
   `DELETE /admin/users/{userId}/sessions` (FR-015).
