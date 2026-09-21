# Tasks: GRC Platform Foundation and Risk Management

**Input**: Design documents from `/specs/001-grc-platform-foundation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks **are** included and are **mandatory**. The specification requires them
(SC-014, SC-015, SC-016) and Constitution IX makes a feature with missing or failing required tests
incomplete by definition.

**Organization**: Tasks are grouped by user story (US1–US9 from spec.md, priorities P1–P9) so each
story can be implemented, tested and demonstrated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US9)
- Exact file paths are included in every task

## Path Conventions

Per [plan.md](./plan.md) — pnpm workspace monorepo:

- Backend: `apps/api/src/` with `core/` (platform) and `modules/` (business domains)
- Frontend: `apps/web/src/`
- Shared: `packages/design-system/`, `packages/api-types/`
- Tests: `apps/api/test/{unit,integration,contract}/`, `apps/web/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository, toolchain and reproducible local infrastructure

- [X] T001 Create pnpm workspace monorepo structure per plan.md in `pnpm-workspace.yaml` and root `package.json`
- [X] T002 [P] Initialize NestJS 11 application in `apps/api/` with `src/main.ts` and `src/app.module.ts`
- [X] T003 [P] Initialize Next.js 15 App Router application in `apps/web/` with `src/app/layout.tsx`
- [X] T004 [P] Initialize `packages/design-system/` with Tailwind CSS 4 and shadcn/ui configuration
- [X] T005 [P] Initialize `packages/api-types/` with the OpenAPI-to-TypeScript generation script
- [X] T006 [P] Configure strict TypeScript (`strict`, `noUncheckedIndexedAccess`) in `tsconfig.base.json` and per-app `tsconfig.json`
- [X] T007 [P] Configure ESLint and Prettier at repository root in `eslint.config.mjs` and `.prettierrc`
- [X] T008 Configure `eslint-plugin-boundaries` module dependency rules per ADR-011 in `apps/api/eslint.config.mjs`
- [X] T009 [P] Create `docker-compose.yml` with PostgreSQL 17 and Redis 7 services, bootstrapping two database roles — an owner/migration role and a restricted application role — as required by ADR-005
- [X] T010 [P] Create `docker-compose.test.yml` with isolated PostgreSQL and Redis for integration and e2e runs
- [X] T011 [P] Create `.env.example` documenting every variable with safe development defaults and no real secrets
- [X] T012 [P] Create `docker/api.Dockerfile` and `docker/web.Dockerfile`
- [X] T013 Configure CI running lint, type-check, unit, integration and contract tests in `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Platform capabilities every user story depends on — persistence, request context, error
handling, the audit engine, the authorization engine, the organizational scope engine, and the design
system baseline.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Infrastructure and cross-cutting

- [X] T014 Initialize Prisma with the PostgreSQL datasource and client generator in `apps/api/prisma/schema.prisma`
- [X] T015 [P] Implement environment schema validation — including the separate `DATABASE_URL` (restricted app role) and `DATABASE_MIGRATION_URL` (owner role), and runtime-configurable session idle and absolute TTLs — in `apps/api/src/infrastructure/config/env.schema.ts`
- [X] T016 [P] Implement `PrismaService` and the interactive transaction manager in `apps/api/src/infrastructure/prisma/prisma.service.ts`
- [X] T017 [P] Implement the Redis client provider in `apps/api/src/infrastructure/redis/redis.service.ts`
- [X] T018 [P] Implement pino structured logging with the four categories and the redaction list per ADR-012 in `apps/api/src/infrastructure/logging/logger.ts`
- [X] T019 Implement `RequestContext` (actor, session, IP, user agent, correlation id) over `AsyncLocalStorage` in `apps/api/src/infrastructure/logging/request-context.ts`
- [X] T020 [P] Implement the shared kernel — domain errors, result types, pagination primitives — in `apps/api/src/shared/`
- [X] T021 Implement the global exception filter producing RFC 9457 `application/problem+json` per ADR-009 in `apps/api/src/infrastructure/http/problem-details.filter.ts`
- [X] T022 [P] Configure the global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` in `apps/api/src/infrastructure/http/validation.ts`
- [X] T023 [P] Implement `/api/v1/health/live` and `/api/v1/health/ready` — under the versioned prefix so they are reachable through the Next.js rewrite — in `apps/api/src/infrastructure/health/health.controller.ts`
- [X] T024 [P] Configure helmet security headers and `@nestjs/throttler` rate limiting in `apps/api/src/main.ts`
- [X] T025 Configure `@nestjs/swagger` OpenAPI 3.1 generation to `apps/api/openapi.json` with a CI staleness check

### Audit engine (ADR-005)

- [X] T026 Define the `audit_event` model in `apps/api/prisma/schema.prisma`
- [X] T027 Create the raw SQL migration for monthly `RANGE` partitioning of `audit_event` in `apps/api/prisma/migrations/`
- [X] T028 Create the raw SQL migration granting the application role `INSERT`/`SELECT` only, revoking `UPDATE`/`DELETE`, and adding the append-only trigger on `audit_event`, in `apps/api/prisma/migrations/`
- [X] T029 Implement `AuditRecorder` writing inside the caller's transaction in `apps/api/src/core/audit/application/audit-recorder.service.ts`
- [X] T030 Implement the per-entity audit field allow-list in `apps/api/src/core/audit/domain/audit-field-allowlist.ts`
- [X] T031 [P] Integration test: audit row commits with the change and is absent after rollback, in `apps/api/test/integration/audit-transactional.spec.ts`
- [X] T032 [P] Integration test: direct `UPDATE`/`DELETE` on `audit_event` is rejected by the database, in `apps/api/test/integration/audit-append-only.spec.ts`

### Authorization engine (ADR-003)

- [X] T033 Define `Permission`, `Role`, `RolePermission`, `UserRole` models in `apps/api/prisma/schema.prisma`
- [X] T034 Implement the permission identifier registry and its generated TypeScript union in `apps/api/src/core/authorization/domain/permissions.ts`
- [X] T035 Implement `PermissionGuard` and the `@RequirePermission` decorator in `apps/api/src/core/authorization/presentation/permission.guard.ts`
- [X] T036 Implement effective-permission resolution with a Redis cache keyed by `permissionsVersion` in `apps/api/src/core/authorization/application/permission-resolver.service.ts`

### Organizational scope engine (ADR-004)

- [X] T037 Define `OrganizationalUnit` and `OrgScopeGrant` models with the materialized `path` column in `apps/api/prisma/schema.prisma`
- [X] T038 Implement materialized path maintenance and cycle prevention in `apps/api/src/core/organizations/domain/org-unit-path.ts`
- [X] T039 Implement `ScopeResolver` producing a scope filter, cached in Redis, in `apps/api/src/core/organizations/application/scope-resolver.service.ts`
- [X] T040 Implement the `ScopedRepository` base requiring a mandatory `ScopeFilter` argument in `apps/api/src/shared/persistence/scoped-repository.ts`
- [X] T040a Implement `DENIED` audit-outcome emission for authorization and organizational-scope refusals (FR-037) in `apps/api/src/core/audit/application/denied-outcome.interceptor.ts`
- [X] T040b [P] Integration test: a permission refusal and an out-of-scope access each write a `DENIED` audit entry carrying actor, action and entity (FR-037) in `apps/api/test/integration/audit-denied.spec.ts`
- [X] T041 [P] Unit test: descendant expansion, `GLOBAL` grant and empty-scope behavior in `apps/api/test/unit/scope-resolver.spec.ts`
- [X] T042 Implement the Prisma seed for permissions, system roles and the root organizational unit, plus a development-only fixture (behind an explicit flag) providing one user per system role and a two-level organizational unit tree so later stories can be validated, in `apps/api/prisma/seed/platform.seed.ts`

### Design system baseline

- [X] T043 [P] Define design tokens — typography, spacing, radius, elevation, color, semantic status, risk severity, interaction states — in `packages/design-system/src/tokens/`
- [X] T044 [P] Generate the shadcn/ui base primitives into `apps/web/src/components/ui/`
- [X] T045 [P] Implement `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog` in `packages/design-system/src/components/`
- [X] T046 [P] Implement `StatusBadge` and `RiskLevelBadge` with indicators that do not rely on color alone in `packages/design-system/src/components/`
- [X] T047 [P] Implement the API client with cookie forwarding and problem+json error mapping in `apps/web/src/lib/api-client.ts`
- [X] T048 Configure Next.js rewrites proxying `/api/*` to the API per ADR-014 in `apps/web/next.config.ts`
- [X] T049 Configure Vitest and Playwright projects in `apps/api/vitest.config.ts` and `apps/web/playwright.config.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Secure Access to the GRC Workspace (Priority: P1) 🎯 MVP

**Goal**: A user signs in on a professional login screen, lands on the GRC dashboard inside a
consistent shell with sidebar and header, sees their profile, and signs out. Sessions expire and can
be revoked. Every authentication and session event is audited.

**Independent Test**: Provision a user, sign in with valid credentials, confirm arrival at the
dashboard, confirm the profile shows the correct identity, sign out, confirm the session is rejected
afterwards, and confirm sign-in/sign-out/failure events appear in the audit trail.

### Tests for User Story 1

- [X] T050 [P] [US1] Contract test: unauthenticated request to a protected endpoint returns 401 in `apps/api/test/contract/auth-required.spec.ts`
- [X] T051 [P] [US1] Contract test: login success, and failure returning a generic non-disclosing message, in `apps/api/test/contract/auth-login.spec.ts`
- [X] T052 [P] [US1] Integration test: session creation, expiry, revocation and logout in `apps/api/test/integration/session-lifecycle.spec.ts`
- [X] T053 [P] [US1] Integration test: audit events for login, failed login, logout and revocation in `apps/api/test/integration/session-audit.spec.ts`
- [X] T054 [P] [US1] Unit test: password policy validation in `apps/api/test/unit/password-policy.spec.ts`
- [X] T055 [P] [US1] Integration test: deactivating a user revokes their sessions and blocks authentication in `apps/api/test/integration/user-deactivation-auth.spec.ts`
- [X] T056 [P] [US1] E2E test: sign in, reach dashboard, sign out in `apps/web/e2e/auth.spec.ts`

### Implementation for User Story 1

- [X] T057 [P] [US1] Define `User`, `LocalCredential`, `ExternalIdentity`, `Session` models and their enums in `apps/api/prisma/schema.prisma`
- [X] T058 [US1] Implement the `AuthenticationProvider` port and `AuthenticationResult` per ADR-001 in `apps/api/src/core/identity/domain/authentication-provider.ts`
- [X] T059 [US1] Implement `LocalAuthenticationProvider` with argon2id in `apps/api/src/core/identity/infrastructure/providers/local/local-authentication.provider.ts`
- [X] T060 [P] [US1] Implement the password policy domain service in `apps/api/src/core/identity/domain/password-policy.ts`
- [X] T061 [US1] Implement `IdentityResolver` mapping a verified external subject to the internal `User` in `apps/api/src/core/identity/application/identity-resolver.service.ts`
- [X] T062 [US1] Implement `SessionService` — create, validate, touch, revoke — with PostgreSQL authoritative and Redis as cache, per ADR-002, in `apps/api/src/core/sessions/application/session.service.ts`
- [X] T063 [US1] Implement session cookie handling (httpOnly, Secure, SameSite=Lax, hashed token) in `apps/api/src/core/sessions/infrastructure/session-cookie.ts`
- [X] T064 [US1] Implement the global authentication guard with a `@Public()` opt-out in `apps/api/src/core/sessions/presentation/session.guard.ts`
- [X] T065 [US1] Implement CSRF Origin/Referer validation for state-changing requests in `apps/api/src/infrastructure/http/csrf.middleware.ts`
- [X] T066 [US1] Implement per-account and per-origin login throttling in `apps/api/src/core/identity/application/login-throttle.service.ts`
- [X] T067 [US1] Implement the auth endpoints — login, logout, current user, change own password — in `apps/api/src/core/identity/presentation/auth.controller.ts`
- [X] T068 [US1] Wire authentication and session audit events through `AuditRecorder` in `apps/api/src/core/sessions/application/session.service.ts`
- [X] T069 [US1] Seed the initial administrator with `mustChangePassword` in `apps/api/prisma/seed/admin.seed.ts`
- [X] T070 [P] [US1] Implement the login screen in `apps/web/src/app/(public)/login/page.tsx`
- [X] T071 [US1] Implement the navigation registry with implemented and planned module entries in `apps/web/src/components/shell/navigation-registry.ts`
- [X] T072 [US1] Implement the authenticated layout shell in `apps/web/src/app/(app)/layout.tsx`
- [X] T073 [P] [US1] Implement `Sidebar`, `Header` and `UserMenu` in `apps/web/src/components/shell/`
- [X] T074 [P] [US1] Implement the toast feedback provider used by every screen in `apps/web/src/components/shell/feedback-provider.tsx`
- [X] T075 [P] [US1] Implement the profile page in `apps/web/src/app/(app)/profile/page.tsx`
- [X] T076 [US1] Implement the dashboard route with planned-module cards and no fabricated metrics in `apps/web/src/app/(app)/dashboard/page.tsx`
- [X] T077 [US1] Implement session expiry detection and redirect without losing entered data in `apps/web/src/lib/api-client.ts`
- [X] T078 [US1] Implement the `usePermissions` hook for advisory UI gating in `apps/web/src/lib/permissions.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Capture and Maintain Risk Records (Priority: P2)

**Goal**: A risk analyst records a risk with descriptive, ownership and classification information,
saves it as a draft, returns to complete it, and edits it. The record carries a unique human-readable
code, an owner, a responsible person and an organizational unit.

**Independent Test**: Create a risk with required fields, confirm a unique code is assigned, reopen and
edit it, confirm changes persist and are audited, and confirm a user without create permission is
refused.

### Tests for User Story 2

- [X] T079 [P] [US2] Contract test: create and edit refused without `risk:create` / `risk:edit` in `apps/api/test/contract/risk-permissions.spec.ts`
- [X] T080 [P] [US2] Integration test: creation assigns a unique code and audits field changes with previous and new values in `apps/api/test/integration/risk-crud.spec.ts`
- [X] T081 [P] [US2] Integration test: conflicting concurrent edits return 409 rather than last-write-wins in `apps/api/test/integration/risk-concurrency.spec.ts`
- [X] T082 [P] [US2] E2E test: create a draft risk, edit it, verify persistence in `apps/web/e2e/risk-create.spec.ts`

### Implementation for User Story 2

- [X] T083 [P] [US2] Define `Risk`, `RiskCause`, `RiskConsequence` models and the `RiskStatus`/`RiskLevel` enums in `apps/api/prisma/schema.prisma`
- [X] T084 [P] [US2] Define `RiskCategory`, `RiskType`, `RiskOrigin` reference models in `apps/api/prisma/schema.prisma`
- [X] T085 [US2] Create the migration and seed for risk reference data in `apps/api/prisma/seed/risk-reference.seed.ts`
- [X] T086 [US2] Implement the `Risk` domain entity with required-field and edit-permitted rules in `apps/api/src/modules/risk/domain/risk.entity.ts`
- [X] T087 [P] [US2] Implement the per-year risk code generator in `apps/api/src/modules/risk/domain/risk-code.ts`
- [X] T088 [US2] Implement `RiskRepository` extending `ScopedRepository` in `apps/api/src/modules/risk/infrastructure/risk.repository.ts`
- [X] T089 [US2] Implement the `CreateRisk` use case with audit and scope validation in `apps/api/src/modules/risk/application/create-risk.usecase.ts`
- [X] T090 [US2] Implement the `UpdateRisk` use case with optimistic locking and per-field audit in `apps/api/src/modules/risk/application/update-risk.usecase.ts`
- [X] T091 [US2] Implement risk DTOs and response mappers that never expose Prisma models in `apps/api/src/modules/risk/presentation/dto/`
- [X] T092 [US2] Implement the risk controller — create, get by id, update — in `apps/api/src/modules/risk/presentation/risk.controller.ts`
- [X] T093 [P] [US2] Implement the `FormField` and `FormSection` patterns in `packages/design-system/src/components/form/`
- [X] T094 [P] [US2] Implement `EntityHeader` and `EntityTabs` in `packages/design-system/src/components/entity/`
- [X] T095 [US2] Implement the risk create/edit form in `apps/web/src/features/risks/components/risk-form.tsx`
- [X] T096 [US2] Implement the risk detail page with section tabs, applying the section visibility mapping in data-model.md §3 so unauthorized sections are omitted rather than returned empty (FR-094), in `apps/web/src/app/(app)/risks/[id]/page.tsx`
- [X] T097 [US2] Implement the Overview section in `apps/web/src/features/risks/components/risk-overview.tsx`
- [X] T098 [US2] Implement the Causes and Consequences section with individually editable rows in `apps/web/src/features/risks/components/risk-causes-consequences.tsx`
- [X] T099 [US2] Implement 409 conflict resolution UX preserving the user's entered values in `apps/web/src/features/risks/components/risk-form.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Work the Risk Register at Scale (Priority: P3)

**Goal**: A risk manager filters by status, level and organizational unit, searches by text, sorts,
and pages through a large register. Overdue reviews, high and critical levels, and ownership are
visible at a glance.

**Independent Test**: Load a large seeded register, apply combined filters, search and sorting, page
through results, and confirm correctness, responsiveness, and that only authorized records appear.

### Tests for User Story 3

- [X] T100 [P] [US3] Contract test: page size capped, total count returned, ordering stable, in `apps/api/test/contract/risk-register.spec.ts`
- [X] T101 [P] [US3] Contract test: out-of-scope risks neither listed nor retrievable by direct id in `apps/api/test/contract/risk-scope.spec.ts`
- [X] T102 [P] [US3] Integration test: combined filter, search and sort correctness in `apps/api/test/integration/risk-query.spec.ts`
- [X] T103 [P] [US3] E2E test: filter, search, sort, paginate, and return from detail with state preserved in `apps/web/e2e/risk-register.spec.ts`

### Implementation for User Story 3

- [X] T104 [US3] Create the migration adding register indexes and the GIN trigram search index in `apps/api/prisma/migrations/`
- [X] T105 [US3] Implement `RiskQueryService` with filters, sorting, search, pagination and the `riskLevelBasis` parameter defaulting to `RESIDUAL`, in `apps/api/src/modules/risk/infrastructure/risk-query.service.ts`
- [X] T106 [US3] Implement the `ListRisks` use case applying the mandatory scope filter in `apps/api/src/modules/risk/application/list-risks.usecase.ts`
- [X] T107 [US3] Implement the register endpoint with query DTO validation in `apps/api/src/modules/risk/presentation/risk.controller.ts`
- [X] T108 [P] [US3] Implement the `DataTable` component on TanStack Table with server-side pagination in `packages/design-system/src/components/data-table/data-table.tsx`
- [X] T109 [P] [US3] Implement `FilterBar` and the column visibility control in `packages/design-system/src/components/data-table/`
- [X] T110 [US3] Implement the risk register page in `apps/web/src/app/(app)/risks/page.tsx`
- [X] T111 [US3] Implement register columns with overdue-review and high/critical indicators in `apps/web/src/features/risks/components/risk-register-columns.tsx`
- [X] T112 [US3] Implement filter, sort and page state persistence in the URL in `apps/web/src/features/risks/hooks/use-register-state.ts`
- [X] T113 [US3] Implement empty states distinguishing "no results for these filters" from "no risks yet" in `apps/web/src/features/risks/components/risk-register-empty.tsx`

**Checkpoint**: The register is usable at professional scale.

---

## Phase 6: User Story 4 - Assess Risks and Preserve Assessment History (Priority: P4)

**Goal**: An analyst performs a structured assessment producing inherent and residual levels derived
from the configured methodology. Reassessment preserves the previous assessment and shows the level
change.

**Independent Test**: Assess a risk, confirm levels are derived not entered, reassess with different
inputs, and confirm both assessments remain retrievable with author, date and level delta.

### Tests for User Story 4

- [X] T114 [P] [US4] Unit test: scoring across every matrix cell and both sides of every band boundary in `apps/api/test/unit/risk-scoring.spec.ts`
- [X] T115 [P] [US4] Unit test: factor values outside the configured scale are rejected in `apps/api/test/unit/risk-scoring-validation.spec.ts`
- [X] T116 [P] [US4] Integration test: reassessment appends and preserves prior assessments and repoints the current pointer in `apps/api/test/integration/risk-assessment-history.spec.ts`
- [X] T117 [P] [US4] Integration test: a methodology version change does not rescore historical assessments in `apps/api/test/integration/methodology-versioning.spec.ts`
- [X] T118 [P] [US4] Contract test: the API rejects client-supplied `inherentScore`, `inherentLevel`, `residualScore`, `residualLevel` in `apps/api/test/contract/risk-assessment.spec.ts`
- [X] T119 [P] [US4] E2E test: assess, reassess, and read the history with the level change in `apps/web/e2e/risk-assessment.spec.ts`

### Implementation for User Story 4

- [X] T120 [P] [US4] Define `RiskMethodology`, `RiskMethodologyVersion` and `RiskAssessment` models in `apps/api/prisma/schema.prisma`
- [X] T121 [P] [US4] Implement methodology configuration schema validation in `apps/api/src/modules/risk/domain/methodology.schema.ts`
- [X] T122 [US4] Implement `RiskScoringService` as a pure domain service per ADR-006 in `apps/api/src/modules/risk/domain/risk-scoring.service.ts`
- [X] T123 [US4] Seed the default 5×5 methodology version in `apps/api/prisma/seed/methodology.seed.ts`
- [X] T124 [US4] Implement the `CreateAssessment` use case — append-only insert, repoint current, denormalize levels onto the risk, and refuse with 422 when the supplied `methodologyVersionId` is no longer active — in `apps/api/src/modules/risk/application/create-assessment.usecase.ts`
- [X] T125 [US4] Implement assessment endpoints and DTOs with derived fields marked read-only in `apps/api/src/modules/risk/presentation/assessment.controller.ts`
- [X] T126 [US4] Implement methodology configuration endpoints requiring `methodology:administer` in `apps/api/src/modules/risk/presentation/methodology.controller.ts`
- [X] T127 [P] [US4] Implement the `RiskMatrix` component in `packages/design-system/src/components/risk/risk-matrix.tsx`
- [X] T128 [P] [US4] Implement the `RiskScore` component in `packages/design-system/src/components/risk/risk-score.tsx`
- [X] T129 [US4] Implement the assessment form driven by the configured scales in `apps/web/src/features/risks/components/assessment-form.tsx`
- [X] T130 [US4] Implement the Assessment section presenting inherent and residual as clearly distinct in `apps/web/src/features/risks/components/risk-assessment-section.tsx`
- [X] T131 [US4] Implement the assessment history list with level deltas and attribution in `apps/web/src/features/risks/components/assessment-history.tsx`
- [X] T132 [US4] Implement next-review-date capture and overdue indication in `apps/web/src/features/risks/components/risk-review-schedule.tsx`

**Checkpoint**: Assessment and its history are complete and defensible.

---

## Phase 7: User Story 5 - Define and Track Risk Treatment (Priority: P5)

**Goal**: A risk owner records a treatment strategy with rationale and deadline, associates controls,
and manages treatment actions. Decisions are attributed and auditable, and superseded decisions are
preserved.

**Independent Test**: Record a strategy with rationale and deadline, associate controls, add actions
with owners and due dates, and confirm attribution, preservation of the prior decision, and audit
entries.

### Tests for User Story 5

- [X] T133 [P] [US5] Integration test: a superseded treatment decision is preserved, not overwritten, in `apps/api/test/integration/risk-treatment-history.spec.ts`
- [X] T134 [P] [US5] Integration test: control link and unlink are audited and history is retained in `apps/api/test/integration/risk-control-link.spec.ts`
- [X] T135 [P] [US5] Contract test: treatment operations refused without `risk:treat` in `apps/api/test/contract/risk-treatment.spec.ts`
- [X] T136 [P] [US5] E2E test: record treatment, add actions, link a control, observe the overdue indicator in `apps/web/e2e/risk-treatment.spec.ts`

### Implementation for User Story 5

- [X] T137 [P] [US5] Define `RiskTreatmentDecision` and `RiskTreatmentAction` models with their enums in `apps/api/prisma/schema.prisma`
- [X] T138 [P] [US5] Define `Control`, `Process`, `Asset` and the `RiskControlLink`/`RiskProcessLink`/`RiskAssetLink` models in `apps/api/prisma/schema.prisma`
- [X] T139 [US5] Implement the `RecordTreatmentDecision` use case with supersession in `apps/api/src/modules/risk/application/record-treatment.usecase.ts`
- [X] T140 [US5] Implement treatment action create, update and status-change use cases in `apps/api/src/modules/risk/application/treatment-actions/`
- [X] T141 [P] [US5] Implement overdue computation on read per ADR-015 in `apps/api/src/modules/risk/domain/overdue.ts`
- [X] T142 [US5] Implement control, process and asset link/unlink use cases in `apps/api/src/modules/risk/application/links/`
- [X] T143 [US5] Implement treatment and relationship endpoints in `apps/api/src/modules/risk/presentation/treatment.controller.ts`
- [X] T144 [US5] Implement the Treatment section in `apps/web/src/features/risks/components/risk-treatment-section.tsx`
- [X] T145 [US5] Implement the treatment actions table with overdue highlighting in `apps/web/src/features/risks/components/treatment-actions-table.tsx`
- [X] T146 [US5] Implement the Controls section with link and unlink in `apps/web/src/features/risks/components/risk-controls-section.tsx`

**Checkpoint**: Treatment turns analysis into tracked, accountable action.

---

## Phase 8: User Story 6 - Govern the Risk Lifecycle (Priority: P6)

**Goal**: Risks move deliberately through the lifecycle. Only valid transitions are offered and
accepted, acceptance and closure require an approval by a different user, and every transition is
recorded.

**Independent Test**: Walk a risk through the full valid lifecycle, attempt invalid transitions and
confirm server refusal with the record unchanged, attempt self-approval and confirm refusal, and
confirm every transition appears in the audit trail.

### Tests for User Story 6

- [X] T147 [P] [US6] Unit test: every legal transition accepted and every illegal (from, to) pair refused in `apps/api/test/unit/risk-lifecycle.spec.ts`
- [X] T148 [P] [US6] Unit test: an approver identical to the requester is refused in `apps/api/test/unit/approval-sod.spec.ts`
- [X] T149 [P] [US6] Integration test: concurrent transition requests apply at most one in `apps/api/test/integration/risk-transition-concurrency.spec.ts`
- [X] T150 [P] [US6] Integration test: rejection clears the pending condition, records the decision, and leaves the state unchanged in `apps/api/test/integration/risk-approval.spec.ts`
- [X] T151 [P] [US6] Contract test: closed and archived risks refuse business-content edits while remaining readable in `apps/api/test/contract/risk-immutability.spec.ts`
- [X] T152 [P] [US6] E2E test: an analyst requests acceptance and a second user approves it in `apps/web/e2e/risk-approval.spec.ts`

### Implementation for User Story 6

- [X] T153 [P] [US6] Define `RiskLifecycleTransition` and `Approval` models with the `decidedByUserId <> requestedByUserId` check constraint in `apps/api/prisma/schema.prisma`
- [X] T154 [US6] Implement the declarative lifecycle transition table per ADR-006 in `apps/api/src/modules/risk/domain/risk-lifecycle.ts`
- [X] T155 [US6] Implement transition precondition evaluators in `apps/api/src/modules/risk/domain/transition-preconditions.ts`
- [X] T156 [US6] Implement the `PerformTransition` use case with optimistic locking and audit in `apps/api/src/modules/risk/application/perform-transition.usecase.ts`
- [X] T157 [US6] Implement `RequestApproval` (requires `risk:transition`) and `DecideApproval` (requires `risk:approve`) use cases enforcing `approver ≠ requester` in the domain, in `apps/api/src/modules/risk/application/approvals/`
- [X] T158 [US6] Implement transition and approval endpoints in `apps/api/src/modules/risk/presentation/lifecycle.controller.ts`
- [X] T159 [US6] Implement the available-transitions endpoint filtered by current state and caller permission in `apps/api/src/modules/risk/presentation/lifecycle.controller.ts`
- [X] T160 [US6] Implement the lifecycle action bar offering only valid, permitted transitions in `apps/web/src/features/risks/components/risk-lifecycle-actions.tsx`
- [X] T161 [US6] Implement approval request and decision dialogs with justification capture in `apps/web/src/features/risks/components/approval-dialogs.tsx`
- [X] T162 [US6] Implement the pending-approval indicator on risk detail and in the register in `apps/web/src/features/risks/components/pending-approval-badge.tsx`

**Checkpoint**: The lifecycle is governed, approval-gated and auditable.

---

## Phase 9: User Story 7 - Trace How a Risk Evolved (Priority: P7)

**Goal**: A reviewer reconstructs a risk's full story — level changes across assessments, ownership
changes, treatment decisions, status changes — plus the underlying audit record of field changes.

**Independent Test**: Take a risk through creation, edits, ownership change, assessments, treatment
and status changes, then confirm the History and Audit views present a complete, chronological,
attributed account with previous and new values.

### Tests for User Story 7

- [X] T163 [P] [US7] Integration test: merged history covers assessments, decisions, transitions, approvals and ownership changes in chronological order, in `apps/api/test/integration/risk-history.spec.ts`
- [X] T164 [P] [US7] Contract test: the audit view requires `audit:view` and is scope-filtered in `apps/api/test/contract/risk-audit.spec.ts`
- [X] T165 [P] [US7] E2E test: reconstruct a risk's evolution from the History and Audit tabs in `apps/web/e2e/risk-history.spec.ts`
- [X] T166 [US7] Implement `RiskHistoryQueryService` merging the append-only tables with audit entries in `apps/api/src/modules/risk/infrastructure/risk-history.service.ts`
- [X] T167 [US7] Implement the risk history endpoint in `apps/api/src/modules/risk/presentation/history.controller.ts`
- [X] T168 [US7] Implement the audit query API filtered by permission and scope in `apps/api/src/core/audit/presentation/audit.controller.ts`
- [X] T169 [P] [US7] Implement `AuditTimeline` and `ActivityHistory` components in `packages/design-system/src/components/timeline/`
- [X] T170 [US7] Implement the History section in `apps/web/src/features/risks/components/risk-history-section.tsx`
- [X] T171 [US7] Implement the Audit section, hidden without `audit:view`, in `apps/web/src/features/risks/components/risk-audit-section.tsx`

**Checkpoint**: Every risk is fully traceable without database access.

---

## Phase 10: User Story 8 - Administer Access (Priority: P8)

**Goal**: An administrator manages users, roles composed of granular permissions, the organizational
unit structure, and organizational scope grants. Every change is audited and takes effect on
subsequent requests.

**Independent Test**: Create a user, assign a restricted role and an organizational scope, sign in as
that user, and confirm granted actions succeed while all others are refused by the server.

### Tests for User Story 8

- [X] T172 [P] [US8] Contract test: every administrative endpoint refuses a non-administrator in `apps/api/test/contract/admin-permissions.spec.ts`
- [X] T173 [P] [US8] Integration test: a role permission change applies to the affected user's next request in `apps/api/test/integration/permission-invalidation.spec.ts`
- [X] T174 [P] [US8] Integration test: reparenting an organizational unit updates subtree paths and is audited in `apps/api/test/integration/org-reparent.spec.ts`
- [X] T175 [P] [US8] E2E test: create a scoped user and verify their granted and denied actions in `apps/web/e2e/admin-access.spec.ts`

### Implementation for User Story 8

- [X] T176 [US8] Implement user administration use cases including deactivation with session revocation in `apps/api/src/core/users/application/`
- [X] T177 [US8] Implement role and role-permission administration use cases with permission-version invalidation in `apps/api/src/core/authorization/application/role-admin.service.ts`
- [X] T178 [US8] Implement organizational unit administration with path maintenance and cycle prevention in `apps/api/src/core/organizations/application/org-unit-admin.service.ts`
- [X] T179 [US8] Implement organizational scope grant administration including `GLOBAL` grants in `apps/api/src/core/organizations/application/scope-grant.service.ts`
- [X] T180 [US8] Implement the administration endpoints and DTOs in `apps/api/src/core/users/presentation/`, `apps/api/src/core/authorization/presentation/` and `apps/api/src/core/organizations/presentation/`
- [X] T181 [P] [US8] Implement the users administration page in `apps/web/src/app/(app)/admin/users/page.tsx`
- [X] T182 [P] [US8] Implement the roles and permissions administration page in `apps/web/src/app/(app)/admin/roles/page.tsx`
- [X] T183 [US8] Implement the organizational structure page with tree navigation and scope grants in `apps/web/src/app/(app)/admin/organization/page.tsx`

**Checkpoint**: Least privilege and segregation of duties are administrable, not seeded.

---

## Phase 11: User Story 9 - Collaborate and Attach Evidence (Priority: P9)

**Goal**: Users add attributed comments and upload supporting evidence to a risk. Both are
access-controlled through the parent record, auditable, and reusable by future modules.

**Independent Test**: Add comments and attachments to a risk, confirm attribution and audit, download
an attachment, confirm a user without access to the risk can reach neither, and confirm the capability
is registered for reuse by another entity type.

### Tests for User Story 9

- [X] T184 [P] [US9] Contract test: an attachment is unreachable by direct id without access to its parent record in `apps/api/test/contract/attachment-access.spec.ts`
- [X] T185 [P] [US9] Integration test: disallowed file type, mismatched magic bytes and oversized uploads are rejected with nothing stored, in `apps/api/test/integration/attachment-validation.spec.ts`
- [X] T186 [P] [US9] E2E test: comment on and attach evidence to a risk in `apps/web/e2e/risk-collaboration.spec.ts`

### Implementation for User Story 9

- [X] T187 [P] [US9] Define `Attachment`, `Comment` and `Notification` models with their entity-type enums in `apps/api/prisma/schema.prisma`
- [X] T188 [US9] Implement the `FileStorageProvider` port and `LocalDiskStorageProvider` per ADR-010 in `apps/api/src/core/files/`
- [X] T189 [US9] Implement upload validation — type allow-list, magic-byte sniffing, size limit, checksum — in `apps/api/src/core/files/application/upload.service.ts`
- [X] T190 [US9] Implement the authorization-gated download endpoint with `Content-Disposition` and `nosniff` headers in `apps/api/src/core/files/presentation/attachment.controller.ts`
- [X] T191 [P] [US9] Implement the attachable/commentable entity-type registry in `apps/api/src/core/comments/domain/entity-registry.ts`
- [X] T192 [US9] Implement comment use cases and endpoints in `apps/api/src/core/comments/`
- [X] T193 [US9] Implement the in-app notification service and endpoints in `apps/api/src/core/notifications/`
- [X] T194 [P] [US9] Implement `CommentThread` and `AttachmentList` components in `packages/design-system/src/components/collaboration/`
- [X] T195 [US9] Implement the Comments and Attachments sections in `apps/web/src/features/risks/components/`
- [X] T196 [US9] Implement the notification bell and list in `apps/web/src/components/shell/notifications.tsx`

**Checkpoint**: All nine user stories are independently functional.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Complete the dashboard with real data, validate performance and security at target
volume, and close the review gates.

- [X] T197 [P] Implement dashboard aggregate endpoints — totals, by level, by unit, by category, requiring review, overdue actions, pending approvals — in `apps/api/src/modules/risk/presentation/dashboard.controller.ts`
- [X] T198 [P] Implement Recharts visualizations consuming backend aggregates without recomputing in `apps/web/src/features/dashboard/components/`
- [X] T199 Complete the dashboard with functional risk areas and explicitly planned cards for unimplemented modules in `apps/web/src/app/(app)/dashboard/page.tsx`
- [X] T200 [P] Implement the 50,000-risk performance fixture in `apps/api/prisma/seed/performance.seed.ts`
- [X] T201 Validate all four performance targets declared in plan.md at target volume — register p95 ≤ 400 ms (SC-004), risk detail p95 ≤ 250 ms, dashboard aggregates p95 ≤ 600 ms, and sign-in to dashboard ≤ 10 s (SC-001) — and tune indexes in `apps/api/src/modules/risk/infrastructure/risk-query.service.ts`
- [X] T202 [P] Contract test: no secret, token, session id, stack trace or internal identifier appears in any response, log or audit entry, in `apps/api/test/contract/information-disclosure.spec.ts`
- [X] T203 [P] Accessibility audit and remediation for login, dashboard, register and detail to WCAG 2.1 AA in `apps/web/`
- [X] T204 [P] Add the dependency vulnerability audit step and resolve findings in `.github/workflows/ci.yml`
- [X] T205 Generate and commit `apps/api/openapi.json` and regenerate `packages/api-types/`
- [X] T206 [P] Document module boundaries and the extension points a future GRC module uses in `docs/architecture.md`
- [X] T206a Verify SC-011 by adding a throwaway stub module that exercises every extension point — permission seed registry, navigation registry, dashboard card contribution, `AuditRecorder`, the comments/attachments entity registry and the scoped repository base — confirming no change is needed to the shell, `core/` or Risk Management, then remove it; in `apps/api/src/modules/_extensibility_probe/` and `apps/web/src/components/shell/navigation-registry.ts`
- [X] T207 Run the validation scenarios in `specs/001-grc-platform-foundation/quickstart.md` end to end
- [X] T208 Security review against spec Security requirements and Constitution Principles II, III and XII, recorded in `docs/history/security-review.md`
- [X] T209 Architecture review against plan.md boundaries and Constitution Principles I and VIII, recorded in `docs/history/architecture-review.md`

---

## Requirement Traceability

Every functional requirement in [spec.md](./spec.md) maps to at least one task, and every success
criterion maps to the task that proves it. Consecutive requirements sharing an identical task set are
grouped. This table is the check that implementation has not silently diverged from the specification
(Constitution XIV); update it whenever a task is added, split or removed.

### Functional requirements

| FR | Tasks | FR | Tasks |
|----|-------|----|-------|
| FR-001, FR-002 | T057 | FR-061 | T120, T121 |
| FR-003 | T059 | FR-062 | T118, T122 |
| FR-004 | T058 | FR-063 | T105, T122 |
| FR-005 | T059, T202 | FR-064 | T120, T124 |
| FR-006 | T054, T060 | FR-065 | T116, T124 |
| FR-007 | T051, T067 | FR-066 | T131 |
| FR-008 | T066 | FR-067 | T115, T121 |
| FR-009 | T075 | FR-068 | T117, T123, T124 |
| FR-010 | T067, T068 | FR-069 | T127, T130 |
| FR-011 | T055, T176 | FR-070 | T111, T132 |
| FR-012 | T062 | FR-071 | T137, T139 |
| FR-013 | T057, T062 | FR-072 | T139 |
| FR-014 | T015, T062 | FR-073 | T133, T139 |
| FR-015 | T052, T062 | FR-074, FR-074a | T140 |
| FR-016 | T062, T067 | FR-074b | T141, T145, T197 |
| FR-017 | T055, T176 | FR-074c | T137 |
| FR-018 | T053, T068 | FR-075 | T141, T145 |
| FR-019 | T063, T065 | FR-076 | T134, T142 |
| FR-020 | T057 | FR-077 | T138 |
| FR-021 | T033, T034 | FR-078 | T130, T146 |
| FR-022 | T034 | FR-079 | T083, T154 |
| FR-023 | T033, T177 | FR-080 | T154, T155 |
| FR-024 | T037 | FR-081 | T147, T156 |
| FR-025 | T039, T040, T101 | FR-082 | T159, T160 |
| FR-025a | T039, T179 | FR-083 | T153, T156 |
| FR-025b | T038, T041 | FR-084 | T086, T151 |
| FR-025c | T089 | FR-085 | T149, T156 |
| FR-026 | T035, T064 | FR-086 | T100, T105 |
| FR-027 | T035, T036 | FR-087 | T105, T111 |
| FR-028 | T036, T173 | FR-088 | T105, T109 |
| FR-029 | T154, T157 | FR-089 | T104, T105 |
| FR-029a | T148, T153, T157 | FR-090 | T101, T106 |
| FR-029b | T153, T157 | FR-091 | T046, T111 |
| FR-029c | T153, T162 | FR-092 | T112 |
| FR-029d | T154 | FR-093 | T094, T096 |
| FR-030 | T021, T101 | FR-094 | T096, T171 |
| FR-031 | T029 | FR-095 | T192, T195 |
| FR-032 | T029, T068, T090 | FR-096 | T187, T189 |
| FR-033 | T026, T029 | FR-097 | T185, T189 |
| FR-034 | T028, T032 | FR-098 | T184, T190 |
| FR-035 | T030, T202 | FR-099 | T190 |
| FR-036 | T164, T168 | FR-100 | T189, T192 |
| **FR-037** | **T040a, T040b** | FR-101 | T193, T196 |
| FR-038 | T029, T206, T206a | FR-102 | T081, T083 |
| FR-039 | T072, T073 | FR-103 | T081, T090 |
| FR-040 | T073, T075 | FR-104 | T083, T084, T137 |
| FR-041 | T071, T206a | FR-105 | T163, T166, T170 |
| FR-042 | T071, T078 | FR-106 | T022 |
| FR-043 | T076, T199 | FR-107 | T021, T202 |
| FR-044 | T074, T193, T196 | FR-108 | T018, T202 |
| FR-045 | T045, T046, T093, T094, T108, T109 | FR-109 | T018 |
| FR-046 | T045 | FR-110 | T206, T206a |
| FR-047 | T076 | FR-111 | T008 |
| FR-048 | T197, T199 | FR-112 | T138, T206 |
| FR-049 | T197 | FR-053 | T083, T091 |
| FR-050 | T199 | FR-054 | T080, T087 |
| FR-051 | T199, T206a | FR-055 | T086, T154 |
| FR-052 | T199 | FR-056 | T086 |
| FR-057 | T083, T098 | FR-058 | T090 |
| FR-059 | T022, T091 | FR-060 | T083, T084 |

### Success criteria

| SC | Proven by |
|----|-----------|
| SC-001 | T201 |
| SC-002 | quickstart.md validation scenario (manual, moderated) |
| SC-003 | T103, T201 |
| SC-004 | T200, T201 |
| SC-005 | T031, T032 |
| SC-006 | T079, T172 |
| SC-007 | T116 |
| SC-008 | T147 |
| SC-009 | T165 |
| SC-010 | T202 |
| SC-011 | T206a |
| SC-012 | T203 |
| SC-013 | T199 |
| SC-014 | every test task across Phases 2–12 |
| SC-015 | T101, T102 |
| SC-016 | T148, T150 |

### Tasks that intentionally trace to no functional requirement

The tables above name the tasks that **evidence** each requirement, not every task that contributes to
it. 137 of the 212 tasks appear. The remaining 75 trace to a different authority, and their absence
here is correct rather than a coverage gap:

| Tasks | Traces to |
|-------|-----------|
| T001–T025 (excluding those cited above) | plan.md §Project Structure and §Technical Context — repository, toolchain, persistence, logging, error handling, health, OpenAPI generation. The specification describes behavior, not scaffolding |
| T043–T049 | plan.md §Structure Decision — design system baseline, API client, single-origin rewrite (ADR-014), test runner configuration |
| T069, T085 | data-model.md §14 Migration and seed policy |
| Supporting implementation tasks (repositories, controllers, endpoint wiring, individual UI sections) | The FR their parent capability is mapped to; they are the mechanism, not the evidence |
| T198, T204, T205, T207–T209 | Constitution IX, XI and XII quality gates, and the plan's review steps |

When a task is added, split or removed, update the matrix above if it is the task that demonstrates a
requirement; otherwise record which authority it traces to here.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **User Stories (Phases 3–11)**: All depend on Foundational
- **Polish (Phase 12)**: Depends on the user stories whose data it aggregates (US2–US6)

### User Story Dependencies

Most stories are independent after Phase 2. Three genuine dependencies exist and are unavoidable
because they reflect real domain layering:

- **US1 (P1)**: No dependencies. This is the MVP.
- **US2 (P2)**: No dependencies on other stories. Needs Foundational only.
- **US3 (P3)**: Needs US2 — a register requires risk records to list.
- **US4 (P4)**: Needs US2 — an assessment attaches to a risk.
- **US5 (P5)**: Needs US2. Independent of US4 in principle, though residual risk is most meaningful after US4.
- **US6 (P6)**: Needs US2 and US4 — the acceptance transition has an assessment precondition.
- **US7 (P7)**: Needs US2; becomes fully meaningful after US4, US5 and US6 produce history to trace.
- **US8 (P8)**: No dependencies on other stories. Can be built in parallel with any of US2–US7.
- **US9 (P9)**: Needs US2 — comments and attachments hang off a risk record.

### Within Each User Story

- Tests are written first and must fail before implementation begins
- Prisma models → migrations → domain → repositories → application use cases → controllers/DTOs
- Design system components before the feature screens that consume them
- Backend before the frontend that calls it

### Parallel Opportunities

- All Phase 1 tasks marked [P] run in parallel
- Within Phase 2, the four engine groups (audit, authorization, organizational scope, design system)
  are independent of one another once T014–T025 are done
- All test tasks within a story marked [P] run in parallel
- **US8 runs fully in parallel with US2–US7** — different files, no shared state
- Design system tasks ([P] in packages/design-system) run in parallel with backend work throughout

---

## Parallel Example: User Story 4

```bash
# Write all User Story 4 tests together first (they must fail):
Task: "Unit test: scoring across every matrix cell and band boundary in apps/api/test/unit/risk-scoring.spec.ts"
Task: "Unit test: out-of-scale factor rejection in apps/api/test/unit/risk-scoring-validation.spec.ts"
Task: "Integration test: reassessment preserves prior assessments in apps/api/test/integration/risk-assessment-history.spec.ts"
Task: "Integration test: methodology version change does not rescore history in apps/api/test/integration/methodology-versioning.spec.ts"
Task: "Contract test: API rejects client-supplied derived scores in apps/api/test/contract/risk-assessment.spec.ts"

# Then the independent implementation pieces:
Task: "Define RiskMethodology, RiskMethodologyVersion, RiskAssessment models in apps/api/prisma/schema.prisma"
Task: "Implement methodology configuration schema validation in apps/api/src/modules/risk/domain/methodology.schema.ts"
Task: "Implement RiskMatrix component in packages/design-system/src/components/risk/risk-matrix.tsx"
Task: "Implement RiskScore component in packages/design-system/src/components/risk/risk-score.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **critical, blocks everything**
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: sign in, reach the dashboard inside the shell, view the profile, sign out,
   confirm session expiry and revocation, confirm the audit trail contains the authentication events
5. This is a demonstrable, secure enterprise shell — deployable and reviewable on its own

### Incremental Delivery

| Increment | Stories | Demonstrable outcome |
|-----------|---------|----------------------|
| 1 | Setup + Foundational + US1 | Secure access to a professional GRC workspace (MVP) |
| 2 | + US2 | Risks can be recorded and maintained |
| 3 | + US3 | The register is usable at professional scale |
| 4 | + US4 | Assessment with preserved history — the analytical core |
| 5 | + US5 | Treatment with tracked actions and control links |
| 6 | + US6 | A governed, approval-gated lifecycle |
| 7 | + US7 | Full traceability of a risk's evolution |
| 8 | + US8 | Administrable access control |
| 9 | + US9 + Polish | Collaboration, evidence, dashboard and review gates |

### Parallel Team Strategy

After Phase 2 completes:

- **Developer A**: US2 → US3 → US4 (the risk core, in dependency order)
- **Developer B**: US8 (fully independent), then US9
- **Developer C**: design system components and frontend shell work, feeding A and B
- US5, US6 and US7 join once US2 and US4 land

---

## Notes

- [P] means different files with no dependency on incomplete work
- Every task names an exact file path
- Tests must be written and observed failing before the corresponding implementation
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Task T205 regenerates the API types; run it whenever a DTO changes, not only at the end
