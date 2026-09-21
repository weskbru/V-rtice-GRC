<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 -> 1.1.0
Bump rationale: MINOR. Existing guidance in Principle X (User Experience Consistency) is materially
expanded with an explicit, binding UI language rule: the v1 user-facing interface is permanently
Brazilian Portuguese (pt-BR), user-facing English text must not be reintroduced, and technical
identifiers are explicitly scoped out of the rule. No principle was removed or redefined in a way
that invalidates prior compliance.

Modified principles:
  - X. User Experience Consistency -> added the pt-BR interface language requirement and its scope
    (technical identifiers excluded); Rationale extended by one sentence.

Added sections: none

Removed sections: none

Dependent artifacts reconciled in this change:
  - CLAUDE.md — Frontend section (§11) states the pt-BR rule and that it binds subagents.
  - AGENTS.md — General rules section states the pt-BR rule.
  - specs/001-grc-platform-foundation/plan.md — Technical Context records the UI language; the
    Constitution Check table's Principle X row references it.
  - docs/local-environment.md — D-8 records the decision, rationale and accepted consequences.

Deferred TODOs: none
-->

# PharosGRC Constitution

PharosGRC is a corporate Governance, Risk and Compliance (GRC) platform. This constitution
defines the mandatory engineering and product-development rules for the platform. It applies to
every specification, architecture decision, implementation and code review. Where a rule uses
MUST or MUST NOT, it is non-negotiable; where it uses SHOULD, a deviation MUST be documented
with its rationale.

## Core Principles

### I. GRC Domain Integrity

- Business concepts MUST be modeled explicitly, with domain-specific names and types. Generic
  catch-all entities, untyped key/value structures and free-form JSON blobs MUST NOT be used to
  represent core GRC concepts without a documented architectural justification.
- Each GRC domain (Risks, Problems, Incidents, Controls, Assets, Processes, Action Plans,
  Compliance, Audits) MUST own its bounded context. Cross-domain access MUST occur through
  explicit, declared interfaces; direct reach-in to another domain's internal model or tables is
  prohibited.
- Relationships between domains MUST be modeled explicitly (for example Risk -> Control,
  Risk -> Incident, Action Plan -> Risk) rather than through undifferentiated generic linkage.
- Terminology MUST be consistent across database, API, backend, frontend and documentation. One
  business concept, one name.
- Adding a new GRC module MUST NOT require changes to the platform core, to the navigation
  architecture, or to any unrelated business module.

Rationale: GRC value comes from the fidelity of its model to real governance practice. Ambiguous
or entangled domains produce records that cannot be trusted, reported or audited.

### II. Security by Design

- Security MUST be addressed at specification and design time, not retrofitted. Every feature
  specification MUST state its authentication, authorization and data-sensitivity implications.
- The default posture MUST be deny. Access MUST be granted explicitly and follow the principle
  of least privilege.
- Authentication and authorization MUST be enforced server-side on every request. Client-side
  checks are presentation only and MUST NEVER be the sole control.
- The identity architecture MUST be provider-agnostic. Business modules MUST depend only on the
  platform's internal identity abstraction, never on a specific provider (local, LDAP, Active
  Directory, OIDC, SAML).
- Secrets, credentials and cryptographic material MUST NOT appear in source code, fixtures,
  logs, error messages, API responses or version control. They MUST be supplied through
  configuration or a secret store.
- All input crossing a trust boundary MUST be validated and, where applicable, normalized before
  use. OWASP Top 10 protections (injection, XSS, CSRF, broken access control, insecure
  deserialization, SSRF and related classes) MUST be applied.
- Passwords and equivalent secrets MUST be stored using a current, deliberately slow hashing
  algorithm. Sensitive data MUST be protected in transit and, where required, at rest.

Rationale: A GRC platform holds an organization's own risk and compliance evidence. A breach
here compromises the very controls the customer relies on.

### III. Identity, Access Control and Segregation of Duties

- Authorization MUST be expressed through explicit users, roles, permissions and organizational
  scopes. Binary administrator/user checks are prohibited as the authorization model.
- Permissions MUST be granular enough to express at least view, create, edit, delete, approve
  and administer, per resource type.
- Organizational scope MUST be part of the access decision. A user's permission MUST be
  evaluated against the organizational unit of the record being accessed.
- Access decisions MUST be centralized in a single authorization layer and applied consistently
  across API, services and data access. Ad-hoc, inline permission logic scattered across
  handlers is prohibited.
- Where a GRC process requires segregation of duties (for example, the author of a risk
  assessment MUST NOT be its sole approver), the constraint MUST be enforced in the domain layer
  and covered by an automated test.
- Sessions MUST be explicitly managed, recording creation time, expiration, last activity,
  revocation capability, IP address, user agent and authentication method where applicable.

Rationale: Segregation of duties and least privilege are the controls GRC customers are
themselves audited against; the platform must be able to demonstrate them.

### IV. Auditability and Traceability

- Every business-critical operation (create, modify, state transition, approval, permission
  change, deletion, authentication event) MUST produce an audit record.
- Audit records MUST be centralized and MUST capture, where applicable: actor, timestamp,
  action, entity type, entity identifier, previous values, new values, IP address, user agent
  and operation context.
- Audit trails MUST be append-only from the application's perspective. Application code MUST NOT
  update or delete audit records.
- Historical information with audit relevance MUST NOT be silently overwritten. When a record
  that carries history changes, the prior state MUST be preserved.
- Every GRC record MUST be traceable across its full lifecycle, from creation through each
  assessment, transition and closure.
- Auditing MUST be implemented as a cross-cutting platform capability, not reimplemented per
  module.

Rationale: An unauditable GRC record has no evidentiary value; auditability is the product, not
a feature of it.

### V. Data Integrity and Governance

- GRC data MUST be treated as authoritative business records. Correctness takes precedence over
  convenience.
- Data quality MUST be protected at the database level using constraints: NOT NULL, unique
  constraints, foreign keys, check constraints and appropriate types. Application validation
  complements but MUST NOT replace them.
- Referential integrity between related GRC entities MUST be enforced by the database.
- Records requiring historical traceability MUST NOT be hard-deleted. Removal MUST be
  represented by an explicit lifecycle state or logical deletion that preserves history and
  audit linkage.
- Lifecycle state, ownership, responsibility and approval MUST be explicit, first-class fields
  on records where the domain requires them; they MUST NOT be inferred from side effects.
- Validation rules MUST be defined once in the domain and applied consistently; duplicated,
  divergent validation between API, service and UI layers is prohibited.

Rationale: Regulators and auditors treat these records as evidence. Silent data loss or
inconsistency destroys their value retroactively and irreparably.

### VI. Risk Management Integrity

- The risk model MUST support inherent risk, related controls, residual risk, risk treatment,
  treatment plans, action plans, assessments and periodic review.
- Risk assessments MUST be preserved historically. A new assessment MUST create a new record and
  MUST NOT overwrite a prior one.
- Risks MUST be relatable to organizational units, processes, assets, controls, incidents,
  problems and action plans through explicitly modeled relationships.
- Risk scoring, inherent and residual calculations, matrix classification and related business
  rules MUST be centralized in a single domain component. Duplicating calculation logic in the
  API, UI, reports or database is prohibited.
- Changes to risk calculation logic or scoring scales MUST be versioned and MUST NOT
  retroactively alter the stored results of historical assessments.
- Every risk calculation rule MUST be covered by dedicated automated tests, including boundary
  values.

Rationale: Risk figures drive executive decisions and audit conclusions; a value that cannot be
reproduced or explained after the fact is worse than no value.

### VII. Workflow and Accountability

- Every GRC process with business significance MUST declare explicit states, permitted
  transitions, the responsibility for each transition and any required approvals.
- State transitions MUST be validated against the declared state machine. Implicit or
  side-effect-driven transitions are prohibited.
- Invalid transitions MUST be rejected with a clear error and MUST NOT leave the record in an
  intermediate state.
- Every action requiring accountability MUST be attributable to an identified user. System- or
  job-initiated actions MUST be attributed to an explicitly identified system principal.
- Approvals MUST record who approved, when, and what was approved.

Rationale: Accountability that cannot be attributed cannot be enforced, and a workflow that is
only implied in code cannot be reviewed by the business it governs.

### VIII. Code Quality and Architecture

- TypeScript MUST be used with strict type checking. The `any` type and unchecked type
  assertions MUST NOT be used to bypass the type system; each unavoidable exception MUST be
  justified in a comment.
- The architecture MUST remain modular, cohesive and loosely coupled. Business modules MUST NOT
  take unnecessary direct dependencies on one another.
- Domain logic MUST be separated from infrastructure and presentation concerns. Domain rules
  MUST NOT depend on HTTP, ORM, framework or UI details.
- Premature abstraction is prohibited. Abstractions MUST be introduced in response to a
  demonstrated need, not an anticipated one.
- New third-party dependencies MUST be justified in terms of need, maintenance status, license
  and security posture.
- Business rules MUST be explicit and readable in code. Clarity and maintainability take
  precedence over cleverness or brevity.
- Code MUST pass lint and type-check before it is considered complete.

Rationale: The platform will grow across a dozen domains over years; only an explicit, decoupled
codebase can absorb that growth without accumulating unreviewable complexity.

### IX. Testing Standards

- Business-critical functionality MUST have automated tests. A feature whose required tests are
  missing or failing MUST NOT be considered complete.
- Unit tests MUST cover domain logic and business rules. Integration tests MUST cover important
  system boundaries (API contracts, persistence, authentication providers). End-to-end tests
  MUST cover critical user journeys.
- Security controls, authorization decisions, segregation of duties, risk calculations, workflow
  state transitions and audit-trail generation MUST each receive dedicated tests.
- Authorization tests MUST include negative cases: unauthorized users, out-of-scope
  organizational access and privilege escalation attempts.
- Tests MUST be deterministic. Flaky tests MUST be fixed or removed, never ignored.
- Bug fixes MUST include a regression test that fails before the fix and passes after it.

Rationale: These are the guarantees the platform sells; untested, they are assertions rather
than controls.

### X. User Experience Consistency

- A single enterprise-grade design system MUST be used across all modules. Module-specific
  visual dialects are prohibited.
- Navigation, terminology, forms, tables, filters, status indicators, actions and user feedback
  MUST follow consistent, documented patterns.
- Business terminology in the interface MUST match the domain model and the specification.
- The v1 user-facing interface MUST be written in Brazilian Portuguese (pt-BR). Every new
  user-facing string MUST be added to the centralized message catalogs; user-facing text MUST NOT
  be embedded directly in components.
- User-facing English text MUST NOT be reintroduced once a screen, flow or message has been
  localized to pt-BR.
- Technical identifiers — variable and type names, file names, database identifiers, API routes
  and DTO fields, RFC 9457 `type` URIs, audit action names, operational log messages, code
  comments and test names — are not user interface and remain in English; they MUST NOT be
  conflated with the pt-BR requirement above.
- The interface architecture MUST allow a new GRC module to be added without altering
  fundamental interaction patterns or the application shell (header, sidebar, navigation,
  profile).
- The dashboard MUST be designed as a GRC dashboard, extensible across modules, not as a
  single-domain dashboard.
- Interfaces MUST prioritize clarity, accessibility and efficient workflows for professional GRC
  users. Interactive elements MUST be keyboard-accessible and MUST expose accessible names.
- Errors and validation failures MUST be communicated in terms the user can act on, without
  exposing internal details.

Rationale: GRC practitioners work across modules all day; inconsistency costs them time and
introduces data-entry error into records that must be reliable. A single interface language is
itself a consistency requirement: this platform's professional users operate in Portuguese, and a
partially localized product reintroduces exactly the inconsistency this principle exists to
prevent.

### XI. Performance and Scalability

- Common user operations MUST have declared, measurable performance expectations, defined in the
  specification for the feature.
- N+1 query patterns and unbounded result sets are prohibited. Every list endpoint MUST be
  paginated.
- Queries supporting filters, sorting and lookups MUST be backed by appropriate indexes.
- Caching and asynchronous processing MUST be used where justified by a measured need, and their
  invalidation and failure behavior MUST be explicit.
- The architecture MUST anticipate growth in users, organizations, GRC records, audit events and
  historical data. Designs that assume small data volumes MUST NOT be adopted for audit trails,
  historical assessments or reports.
- Performance-relevant changes MUST be assessed against the declared expectations before merge.

Rationale: Audit and history tables grow without bound by design; a query pattern that is
acceptable on day one can make the platform unusable in year two.

### XII. Observability and Operational Reliability

- The application MUST emit structured logs with correlation identifiers sufficient to trace a
  request end to end.
- Security events, audit events, application errors and operational logs MUST be distinguishable
  by category and MUST NOT be conflated.
- Logs and error messages MUST NOT expose secrets, credentials, tokens, session identifiers,
  personal data or confidential GRC content.
- Errors MUST be handled explicitly. Errors MUST NOT be silently swallowed, and internal details
  (stack traces, SQL, internal identifiers) MUST NOT reach API clients.
- The platform MUST expose health and readiness checks suitable for operational monitoring.
- Critical failures MUST be diagnosable from logs and telemetry without requiring access to
  confidential record content.

Rationale: The platform must be operable and debuggable without its operators becoming an
unaudited channel into customer risk data.

### XIII. API and Integration Standards

- Every API endpoint MUST have an explicit contract, documented via OpenAPI, with typed request
  and response schemas.
- All request input MUST be validated against its schema at the boundary before reaching domain
  logic.
- Error responses MUST follow a single, consistent, documented structure across the API.
- Authentication and authorization MUST be applied uniformly; endpoints MUST be authenticated by
  default, with public endpoints declared explicitly.
- The API MUST have a declared versioning strategy, and breaking contract changes MUST follow
  it.
- External integrations (LDAP, Active Directory, OIDC, SAML, mail, storage and future services)
  MUST be isolated behind well-defined interfaces owned by the platform core. GRC business
  modules MUST NOT depend on an external provider's client, schema or protocol directly.

Rationale: Contracts are how the platform is integrated into a customer's control environment;
they must be stable, explicit and independent of any one vendor.

### XIV. Documentation and Architectural Decisions

- Specifications are the source of truth for intended behavior. Implementation MUST NOT silently
  diverge from an approved specification; a needed divergence MUST be raised and the
  specification updated before or alongside the change.
- Architecturally significant decisions MUST be documented, recording the context, the decision,
  the alternatives considered and the consequences.
- Domain rules (calculations, state machines, permission semantics, lifecycle rules) MUST be
  documented alongside their implementation.
- A proposed architectural change MUST include an explicit impact assessment covering security,
  auditability, data migration, performance and affected modules.
- Documentation MUST be updated in the same change that alters the behavior it describes.

Rationale: In a compliance product the reasoning behind a design is itself evidence;
undocumented decisions cannot be defended in an audit or safely revisited by future engineers.

### XV. Change Management and Backward Compatibility

- Changes MUST be incremental and, wherever practical, reversible. Large, entangled changes MUST
  be decomposed.
- Database migrations MUST be explicit, version-controlled, reviewed and applied through the
  migration tooling. Manual or undocumented schema changes are prohibited.
- Destructive migrations (dropping or narrowing columns, deleting rows, discarding history) MUST
  be reviewed and explicitly approved, and MUST address preservation of historical data.
- Existing API contracts, permission semantics, workflow definitions and stored GRC records MUST
  NOT be broken without deliberate approval and a documented migration path.
- Every architectural decision MUST consider migration, backward compatibility and preservation
  of historical data.
- Changes MUST NOT retroactively alter the meaning of already-recorded GRC or audit data.

Rationale: Customers accumulate years of records against which they will be audited; the meaning
of those records must survive the platform's evolution.

### XVI. Compliance-Oriented Engineering

- Regulatory, policy and audit requirements MUST be treated as first-class architectural
  concerns, on par with functionality.
- The platform MUST be designed to support evidence collection, accountability, traceability,
  approvals and reporting as native capabilities.
- Compliance-relevant behavior MUST be explicit, configurable where appropriate, and documented.
  Hard-coded or undocumented compliance exceptions, bypasses and special cases are prohibited.
- Any mechanism that skips a control (an override, an emergency access path, a bulk operation)
  MUST itself be authorized, audited and documented.
- Where the platform records a compliance obligation, it MUST be able to demonstrate that
  obligation's status and supporting evidence over time.

Rationale: The product's purpose is to make compliance demonstrable; behavior that cannot itself
be demonstrated undermines that purpose.

## Technology and Platform Constraints

- Stack: Next.js, TypeScript, Tailwind CSS and shadcn/ui on the frontend; NestJS and TypeScript
  on the backend; PostgreSQL with Prisma for persistence; Redis for cache and auxiliary
  infrastructure; Docker and Docker Compose for environments; Vitest and Playwright for testing;
  REST APIs documented with OpenAPI.
- Deviation from this stack for a given component requires a documented architectural decision.
- The codebase MUST maintain the separation between the platform Core (authentication,
  authorization, users, organizations, sessions, audit, files, notifications, configuration) and
  the Business Modules (risks, problems, incidents, controls, assets, processes, action plans,
  compliance, audits, reports).
- Core capabilities MUST NOT depend on business modules. Business modules MUST depend on Core
  only through its declared interfaces.
- Configuration MUST be supplied by environment and MUST NOT be committed. Environments MUST be
  reproducible from the repository plus supplied configuration.

## Development Workflow and Quality Gates

Work MUST follow this sequence: Requirement -> Specification -> Architecture -> Plan -> Tasks ->
Implementation -> Tests -> Review. Implementation MUST NOT begin from an informal idea.

During implementation:

- Changes MUST be small, cohesive and scoped to the task at hand. Unrelated modifications MUST
  NOT be bundled in.
- Contracts MUST NOT be modified without an impact assessment.
- New dependencies MUST NOT be introduced without justification.

Before a change is considered complete, all of the following gates MUST pass:

1. Required automated tests exist and pass.
2. Lint passes.
3. Type-check passes.
4. Errors are handled explicitly.
5. The change respects the defined architecture and module boundaries.
6. Security impact has been assessed.
7. Audit impact has been assessed.
8. No unjustified duplication has been introduced.
9. Architecturally relevant decisions are documented.

Code review MUST verify compliance with this constitution. A reviewer MUST reject a change that
violates a MUST rule, or that deviates from a SHOULD rule without a documented rationale.

Work SHOULD be delegated to specialized roles (backend, frontend, database, QA, security review,
architecture review) where the task allows, and delegated results MUST be reviewed before
acceptance.

## Governance

This constitution supersedes other engineering practices and conventions within PharosGRC. Where
a practice, tool default or convenience conflicts with a principle here, the principle prevails.

Amendment procedure:

1. A proposed amendment MUST be submitted in writing, stating the principle affected, the
   change, the rationale and the migration impact on existing specifications, code and data.
2. The amendment MUST be reviewed and explicitly approved by the project's technical leadership.
3. On approval, this document MUST be updated together with a Sync Impact Report, and any
   dependent templates and guidance MUST be reconciled in the same change.

Versioning policy (semantic versioning):

- MAJOR: a principle is removed, or redefined in a way that invalidates prior compliance.
- MINOR: a principle or section is added, or existing guidance is materially expanded.
- PATCH: clarifications, wording and non-semantic refinements.

Compliance review:

- Every pull request MUST be reviewed for constitutional compliance; the review MUST cover
  security, auditability, data integrity and architectural boundaries.
- Complexity, new dependencies and new abstractions MUST be justified against Principle VIII.
- This constitution MUST be reviewed at least annually, and after any significant architectural
  change, to confirm it still reflects the platform's requirements.
- `CLAUDE.md` and `AGENTS.md` provide runtime development guidance and MUST remain consistent
  with this constitution; on conflict, this constitution governs.

**Version**: 1.1.0 | **Ratified**: 2026-09-04 | **Last Amended**: 2026-09-05
