# Feature Specification: GRC Platform Foundation and Risk Management

**Feature Branch**: `master` (no feature branch created — git extension hook not installed)

**Created**: 2026-09-04

**Status**: Concluído — 212/212 tarefas em `tasks.md`, commits desde 2026-09-04.

> **Correção, 2026-09-11** (007-implementation-remediation, Frente G): esta linha dizia "Draft" com
> as 212 tarefas de `tasks.md` já marcadas — a mesma classe de defeito que
> `docs/deferred-findings.md` **F-37** nomeou (um documento não avisado quando a fase que ele
> descreve termina). Substituída pelo estado real, verificado contra o próprio `tasks.md` desta
> pasta, não inferido de outra fonte.

**Input**: User description: "Build the initial Vértice GRC platform with a strong foundation for enterprise Governance, Risk and Compliance (GRC), with Risk Management as the first functional business module. The application must provide a secure and professional enterprise experience and establish the foundation required for future GRC modules such as Problems, Incidents, Controls, Assets, Processes, Action Plans, Compliance, Audits, Indicators and Reports."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Access to the GRC Workspace (Priority: P1)

A GRC professional opens Vértice GRC, signs in with their corporate credentials on a professional
login screen, and lands on a GRC dashboard inside a consistent application shell with sidebar and
header navigation. They can see who they are signed in as, view their profile, and sign out. Their
session expires after a period of inactivity and can be revoked.

**Why this priority**: Nothing else in the platform is reachable or safe without authenticated,
scoped, auditable access. This slice alone delivers a credible, secure enterprise shell that every
future module plugs into.

**Independent Test**: Provision a user, sign in with valid credentials, confirm arrival at the
dashboard within the shell, confirm the profile shows correct identity, sign out, confirm the
session is no longer usable, and confirm sign-in/sign-out/failure events appear in the audit trail.

**Acceptance Scenarios**:

1. **Given** a provisioned active user, **When** they submit valid credentials, **Then** a session
   is created and they are taken to the GRC dashboard within the application shell.
2. **Given** a provisioned user, **When** they submit invalid credentials, **Then** access is
   denied with a generic message that does not reveal whether the account exists, and a failed
   authentication event is audited.
3. **Given** an authenticated user, **When** they sign out, **Then** the session is terminated,
   subsequent requests with it are rejected, and the logout is audited.
4. **Given** an authenticated session, **When** the inactivity timeout elapses, **Then** the
   session expires and the user is returned to the login screen with an explanation.
5. **Given** an unauthenticated visitor, **When** they request any application route or data other
   than login, **Then** access is refused and they are directed to the login screen.
6. **Given** a deactivated user, **When** they attempt to sign in, **Then** access is denied and
   the attempt is audited.

---

### User Story 2 - Capture and Maintain Risk Records (Priority: P2)

A risk analyst records a new risk with its descriptive, ownership and classification information,
saves it as a draft, returns later to complete it, and edits it as understanding improves. The
record carries a human-readable risk code, an owner, a responsible person and an organizational
unit.

**Why this priority**: The risk record is the atomic unit of the first business module; every other
risk capability operates on it.

**Independent Test**: With appropriate permission, create a risk with required fields, confirm a
unique human-readable code is assigned, reopen and edit it, and confirm changes are persisted and
audited. Confirm a user without create permission cannot create one.

**Acceptance Scenarios**:

1. **Given** a user with risk-create permission, **When** they submit a valid new risk, **Then**
   the risk is stored with a unique human-readable code and an audited creation event.
2. **Given** a user with risk-create permission, **When** they submit a risk missing required
   information, **Then** the submission is rejected with field-level messages and nothing is stored.
3. **Given** an existing risk, **When** a user with edit permission changes fields, **Then** the
   changes are stored and each changed field's previous and new values are recorded in the audit
   trail.
4. **Given** an existing risk, **When** a user without edit permission attempts to change it,
   **Then** the change is refused by the server regardless of what the interface offers.
5. **Given** a risk, **When** it is viewed in detail, **Then** information is presented in
   structured sections rather than one undifferentiated form.

---

### User Story 3 - Work the Risk Register at Scale (Priority: P3)

A risk manager responsible for a large portfolio opens the risk register, filters by status, risk
level and organizational unit, searches by text, sorts by residual risk, and pages through results.
Overdue reviews, high and critical risks, and ownership are visible at a glance.

**Why this priority**: A register that cannot be navigated at scale makes the module unusable for
its intended professional audience, even if individual records are correct.

**Independent Test**: Load the register with a large seeded data set, apply combinations of
filters, search and sorting, page through results, and confirm correctness, responsiveness and that
only records within the user's authorized scope appear.

**Acceptance Scenarios**:

1. **Given** many risks exist, **When** the register is opened, **Then** results are paginated with
   a stable, predictable order and a visible total count.
2. **Given** the register, **When** filters for status, risk level and organizational unit are
   applied together, **Then** only records matching all filters are returned.
3. **Given** the register, **When** a text search is performed, **Then** matching records are
   returned based on code, title and description.
4. **Given** a risk whose next review date has passed, **When** it appears in the register,
   **Then** it is visibly flagged as overdue for review.
5. **Given** high and critical risks, **When** they appear in the register, **Then** their risk
   level is visually distinguishable without relying on color alone.
6. **Given** a user whose access is limited to certain organizational units, **When** they open the
   register, **Then** risks outside their authorized scope are neither listed nor retrievable.
7. **Given** filters that match nothing, **When** applied, **Then** an informative empty state is
   shown that distinguishes "no results for these filters" from "no risks exist yet".

---

### User Story 4 - Assess Risks and Preserve Assessment History (Priority: P4)

A risk analyst performs a structured assessment of a risk, recording the factors defined by the
organization's configured risk methodology to produce an inherent risk level, and — accounting for
associated controls — a residual risk level. When the risk is reassessed later, the previous
assessment is preserved and the change in risk level is visible.

**Why this priority**: Assessment is the core analytical value of risk management, and preserved
assessment history is what makes the record defensible in an audit.

**Independent Test**: Assess a risk, confirm inherent and residual levels are derived consistently
from the configured methodology, reassess with different inputs, and confirm both assessments
remain retrievable with author, date and the resulting level change.

**Acceptance Scenarios**:

1. **Given** a configured risk methodology, **When** an assessment is submitted with valid factor
   values, **Then** inherent and residual risk levels are derived by the platform, not entered
   freely by the user.
2. **Given** an assessed risk, **When** it is reassessed, **Then** a new assessment record is
   created and the prior assessment remains retrievable unchanged.
3. **Given** a risk with multiple assessments, **When** its assessment history is viewed, **Then**
   each entry shows who assessed it, when, the factor values, the resulting inherent and residual
   levels, and the change relative to the previous assessment.
4. **Given** an assessment factor value outside the configured scale, **When** submitted, **Then**
   it is rejected with a clear message.
5. **Given** a change to the configured methodology, **When** historical assessments are viewed,
   **Then** their stored results are unchanged and remain interpretable under the methodology
   version in force when they were performed.
6. **Given** an assessed risk, **When** its detail is viewed, **Then** inherent risk and residual
   risk are presented as clearly distinct values with their relationship explained.

---

### User Story 5 - Define and Track Risk Treatment (Priority: P5)

A risk owner decides how to treat a risk — mitigate, avoid, transfer/share or accept — records the
rationale and a deadline, associates the controls relied upon, and defines the treatment actions
required. Treatment decisions are attributed and auditable.

**Why this priority**: Treatment turns analysis into accountable action; without it the register is
an observation log rather than a management tool.

**Independent Test**: Record a treatment strategy with rationale and deadline on a risk, associate
one or more controls, add treatment actions with owners and due dates, and confirm the decision is
attributed to the acting user and appears in the audit trail.

**Acceptance Scenarios**:

1. **Given** a risk, **When** a user with the appropriate permission records a treatment strategy,
   **Then** the strategy, rationale, deadline, deciding user and timestamp are stored and audited.
2. **Given** a risk under treatment, **When** the treatment strategy is later changed, **Then** the
   previous decision is preserved in history rather than overwritten.
3. **Given** a risk, **When** controls are associated with it, **Then** the associations are stored
   and shown, and they can be removed with the change audited.
4. **Given** a treatment with a deadline in the past and incomplete actions, **When** the risk is
   viewed or listed, **Then** the overdue condition is visibly indicated.
5. **Given** a treatment action, **When** it is created, **Then** it carries a responsible user, a
   due date and a status, and its status changes are attributed and audited.

---

### User Story 6 - Govern the Risk Lifecycle (Priority: P6)

A risk moves deliberately through its lifecycle — from draft, through identified, assessed, under
treatment, under review, to accepted, closed or archived. Only valid transitions are offered and
accepted, each transition requires the appropriate permission, and each is recorded.

**Why this priority**: An explicit, enforced lifecycle is what distinguishes a governed GRC record
from an editable row, and it is the foundation on which approvals and reporting depend.

**Independent Test**: Walk a risk through the full valid lifecycle, attempt invalid transitions and
confirm they are refused by the server with the record left unchanged, and confirm every transition
appears in the audit trail with actor and timestamp.

**Acceptance Scenarios**:

1. **Given** a risk in a given state, **When** the detail view is opened, **Then** only transitions
   valid from that state and permitted to the user are offered.
2. **Given** a risk in a given state, **When** a transition not permitted by the lifecycle is
   requested directly, **Then** the server refuses it and the risk remains in its current state.
3. **Given** a transition that requires preconditions (for example, an assessment must exist before
   a risk can be marked assessed), **When** the preconditions are unmet, **Then** the transition is
   refused with an explanation of what is missing.
4. **Given** any accepted transition, **When** it completes, **Then** the previous state, new
   state, acting user, timestamp and any supplied justification are recorded.
5. **Given** a closed or archived risk, **When** a user attempts to edit its business content,
   **Then** the edit is refused and the record remains readable.
6. **Given** a risk proposed for acceptance or closure, **When** the requesting user attempts to
   approve their own request, **Then** the approval is refused by the server on segregation-of-duties
   grounds and the risk does not change state.
7. **Given** a risk awaiting approval, **When** a user with the approve permission rejects it,
   **Then** the risk returns to its prior state and the rejection is recorded with actor, timestamp
   and justification.
8. **Given** a risk awaiting approval, **When** an eligible approver opens the dashboard, **Then**
   it appears in their pending-approvals area.

---

### User Story 7 - Trace How a Risk Evolved (Priority: P7)

An auditor or reviewer opens a risk and reconstructs its full story: how its level changed across
assessments, when ownership changed, what treatment decisions were taken and by whom, every status
change, and the underlying audit record of relevant field changes.

**Why this priority**: Traceability is the evidentiary purpose of the platform; it is what a
customer's own auditors will examine.

**Independent Test**: Take a risk through creation, edits, ownership change, assessments,
treatment and status changes, then confirm its history and audit views present a complete,
chronological, attributed account with previous and new values.

**Acceptance Scenarios**:

1. **Given** a risk with an operating history, **When** its History view is opened, **Then** a
   chronological, attributed account of assessments, level changes, ownership changes, treatment
   decisions and status changes is shown.
2. **Given** a risk, **When** its Audit view is opened by a user with audit-view permission,
   **Then** audit entries show actor, timestamp, action, entity, entity identifier and the relevant
   previous and new values.
3. **Given** any historically relevant change, **When** it is applied, **Then** the prior state is
   preserved rather than silently overwritten.
4. **Given** a user without audit-view permission, **When** they open a risk, **Then** the audit
   view is not available to them.
5. **Given** audit records, **When** any user or interface attempts to modify or delete them,
   **Then** the operation is refused.

---

### User Story 8 - Administer Access (Priority: P8)

An administrator manages users, assigns roles composed of granular permissions, and maintains the
organizational unit structure that scopes access. Permission changes take effect for subsequent
requests and are themselves audited.

**Why this priority**: Least privilege and segregation of duties must be administrable rather than
seeded; this closes the loop on the platform's own control environment. It is prioritized after the
risk capabilities because the initial release can operate on seeded roles while administration is
completed.

**Independent Test**: Create a user, assign a role with a restricted permission set and an
organizational scope, sign in as that user, and confirm the granted actions succeed and all others
are refused by the server. Confirm every administrative change is audited.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they create a user and assign roles and an organizational
   scope, **Then** the user can sign in and exercise exactly the granted permissions.
2. **Given** a role, **When** its permissions are changed, **Then** the change is audited with
   previous and new permission sets and applies to affected users' subsequent requests.
3. **Given** a user, **When** they are deactivated, **Then** their existing sessions are revoked and
   they can no longer authenticate.
4. **Given** the organizational unit structure, **When** a unit is created or reorganized, **Then**
   the change is audited and access scoping reflects the new structure.
5. **Given** a non-administrator, **When** they attempt any administrative operation, **Then** the
   server refuses it.

---

### User Story 9 - Collaborate and Attach Evidence (Priority: P9)

A user adds a comment to a risk to record context or a decision rationale, and attaches supporting
evidence such as an assessment worksheet or a policy extract. Comments and attachments are
attributed, auditable, and access-controlled.

**Why this priority**: Comments and attachments are a shared platform capability every future GRC
module will reuse, and they carry the evidence that makes records defensible — but a risk record is
useful before they exist.

**Independent Test**: Add comments and attachments to a risk, confirm attribution and audit,
download an attachment, confirm a user without access to the risk can reach neither, and confirm
the same capability is available to be reused by another entity type.

**Acceptance Scenarios**:

1. **Given** a risk the user can view, **When** they add a comment, **Then** it is stored with
   author and timestamp and shown in the risk's Comments section.
2. **Given** a risk the user can view, **When** they upload an attachment of an accepted type and
   size, **Then** it is stored, attributed, and listed with its metadata.
3. **Given** an upload of a disallowed type or excessive size, **When** submitted, **Then** it is
   refused with a clear message and nothing is stored.
4. **Given** an attachment, **When** a user without permission to view its parent record requests
   it directly, **Then** access is refused.
5. **Given** a comment or attachment, **When** it is added or removed, **Then** the action is
   audited with actor and timestamp.

---

### Edge Cases

- **Concurrent edits**: Two users edit the same risk simultaneously. The second save must not
  silently discard the first user's changes; the conflict must be surfaced.
- **Concurrent transitions**: Two users request different lifecycle transitions on the same risk at
  the same time. Exactly one must succeed; the other must be refused with the current state shown.
- **Session expiry mid-work**: A session expires while a user is completing a long risk form. The
  user must be informed and must not lose entered data without warning.
- **Session revoked mid-request**: A session is revoked (by administrator action or user
  deactivation) while a request is in flight. The request must be refused, not partially applied.
- **Permission revoked mid-session**: A user's permission is withdrawn while they are signed in.
  The next request requiring that permission must be refused.
- **Scope change**: A risk is moved to an organizational unit outside the current user's scope. It
  must immediately disappear from their register and become unretrievable.
- **Methodology change with in-flight assessments**: The methodology is reconfigured while an
  assessment is being entered. The assessment must either complete against the methodology version
  it started under or be refused with an explanation — never silently rescored.
- **Reassessment producing no change**: A reassessment yields the same level as the previous one.
  It must still be preserved as a distinct assessment record.
- **Deletion of a risk with history**: A deletion request for a risk carrying assessments, audit
  entries and attachments must not destroy that history.
- **Referenced control removed**: A control associated with a risk is removed. The risk must remain
  valid and the removal must be visible in history.
- **Overdue everything**: A risk is simultaneously overdue for review and overdue on treatment. Both
  conditions must be individually visible, not collapsed into one indicator.
- **Empty organization**: A brand-new deployment with no risks, no organizational units and a
  single administrator must present usable empty states and a path to first configuration.
- **Very large register**: A register filtered to tens of thousands of matching records must remain
  responsive and must not attempt to render or return them all.
- **Long free text**: Very long descriptions, causes and consequences must be stored intact and
  must not break list or detail layouts.
- **Unavailable modules on dashboard**: Dashboard areas for modules not yet implemented must be
  clearly marked as planned and must not present fabricated numbers.
- **Attachment name collisions and unsafe names**: Files with identical or unsafe names must be
  stored without collision and served without enabling script execution in the browser.
- **Repeated failed sign-in**: Repeated failed authentication attempts must be audited and rate
  limited without revealing whether the account exists.

## Requirements *(mandatory)*

### Functional Requirements

#### Identity and Authentication

- **FR-001**: System MUST represent every person as an internal platform identity that is
  independent of the mechanism used to authenticate them.
- **FR-002**: System MUST record, for each identity, which authentication method or provider is
  associated with it, and MUST support more than one method existing in the platform concurrently.
- **FR-003**: System MUST provide local username/password authentication as the operational
  authentication method in the initial release.
- **FR-004**: System MUST be structured so that LDAP, Active Directory, OIDC and SAML authentication
  can be added later without modifying Risk Management business rules, risk data, or any business
  module's behavior.
- **FR-005**: System MUST store user secrets only in a non-reversible, deliberately slow hashed
  form, and MUST NOT expose them through any interface, log or export.
- **FR-006**: System MUST enforce a configurable password policy for local authentication covering
  at minimum minimum length and complexity.
- **FR-007**: System MUST return a generic failure message for failed sign-in that does not disclose
  whether the account exists, is deactivated or has the wrong secret.
- **FR-008**: System MUST rate limit repeated failed authentication attempts per account and per
  origin.
- **FR-009**: System MUST allow a user to view their own profile, including name, contact
  identifier, roles and organizational unit.
- **FR-010**: System MUST allow a user with local authentication to change their own password after
  confirming their current one, and MUST audit the change.
- **FR-011**: System MUST prevent deactivated users from authenticating.

#### Sessions

- **FR-012**: System MUST create an identifiable session upon successful authentication.
- **FR-013**: System MUST record, for each session, the user, creation time, expiration, last
  activity, IP address, user agent and authentication method.
- **FR-014**: System MUST expire sessions after a configurable period of inactivity and after a
  configurable absolute lifetime.
- **FR-015**: System MUST allow a session to be revoked, and MUST refuse all subsequent requests
  presenting a revoked or expired session.
- **FR-016**: System MUST terminate the session on user-initiated sign-out.
- **FR-017**: System MUST revoke all of a user's sessions when that user is deactivated or their
  password is changed.
- **FR-018**: System MUST audit session creation, expiration, revocation and sign-out.
- **FR-019**: System MUST transmit session credentials in a way that is not readable by client-side
  scripts and MUST protect state-changing requests against cross-site request forgery.
- **FR-020**: System MUST store session data such that a future capability for users to view and
  revoke their own active sessions can be added without changing the session model.

#### Authorization and Organizational Scope

- **FR-021**: System MUST express authorization through users, roles, permissions and organizational
  scopes, and MUST NOT rely on a binary administrator/user distinction.
- **FR-022**: System MUST support permissions expressing at minimum view, create, edit, delete,
  approve and administer, per resource type.
- **FR-023**: System MUST allow roles to be composed of arbitrary sets of permissions and assigned
  to users.
- **FR-024**: System MUST support an organizational unit structure to which users and GRC records
  can be assigned.
- **FR-025**: System MUST evaluate every access decision against both the user's permissions and the
  organizational scope of the record being accessed, enforced from this release on every read and
  every write of a risk and its related records.
- **FR-025a**: System MUST support granting a user or role a global organizational scope conferring
  access across all organizational units, and MUST treat that grant as an explicit, audited
  assignment rather than an implicit default.
- **FR-025b**: System MUST resolve a user's authorized organizational units to include the units
  granted to them and their descendants in the organizational structure.
- **FR-025c**: System MUST refuse creation or reassignment of a risk into an organizational unit
  outside the acting user's authorized scope.
- **FR-026**: System MUST enforce every authorization decision on the server for every request.
  Interface-level hiding of actions MUST NOT be the sole control.
- **FR-027**: System MUST evaluate authorization through a single centralized mechanism used
  consistently by all modules.
- **FR-028**: System MUST apply permission changes to a user's subsequent requests without requiring
  the user to sign in again.
- **FR-029**: System MUST require an approval, granted by a user holding the approve permission, for
  a risk to enter the accepted state and for a risk to enter the closed state.
- **FR-029a**: System MUST refuse an approval granted by the same user who requested the transition,
  enforcing segregation of duties on the server.
- **FR-029b**: System MUST record each approval request and each approval decision with the
  requesting user, the deciding user, the decision (approved or rejected), the timestamp and any
  justification supplied.
- **FR-029c**: System MUST represent a risk awaiting approval as an explicit pending-approval
  condition on the risk — not as an additional lifecycle state — visible to both the requester and
  eligible approvers, and MUST leave the risk in its current lifecycle state until the approval is
  granted, clearing the condition and recording the rejection if the approval is refused.
- **FR-029d**: System MUST express approval requirements as configuration of the lifecycle rather
  than as behavior embedded in interface components, so that further approval gates can be added
  without restructuring the lifecycle.
- **FR-030**: System MUST refuse unauthorized requests with a response that does not disclose the
  existence or content of records the user may not see.

#### Audit

- **FR-031**: System MUST provide a single centralized audit capability used by all modules rather
  than per-module implementations.
- **FR-032**: System MUST record an audit entry for each of: authentication success and failure,
  sign-out, session creation and revocation, user creation/modification/deactivation, role and
  permission changes, organizational unit changes, risk creation, risk field changes, risk
  assessments, treatment decisions, control associations, lifecycle transitions, comment and
  attachment addition and removal.
- **FR-033**: System MUST capture in each audit entry, where applicable: actor, timestamp, action,
  entity type, entity identifier, previous values, new values, IP address, user agent and operation
  context.
- **FR-034**: System MUST treat audit entries as append-only; no interface or operation may modify
  or delete them.
- **FR-035**: System MUST exclude secrets, credentials and session identifiers from audit entry
  content.
- **FR-036**: System MUST allow users with audit-view permission to view the audit trail for a risk,
  filtered to entries they are authorized to see.
- **FR-037**: System MUST record audit entries for operations that are refused on authorization
  grounds where those refusals are security-relevant.
- **FR-038**: System MUST make the audit capability directly reusable by future GRC modules without
  modification to its core.

#### Application Shell and Navigation

- **FR-039**: System MUST present a consistent application shell comprising a persistent sidebar
  navigation, a top header, and a content area.
- **FR-040**: System MUST show in the header the signed-in user's identity and provide access to
  profile and sign-out.
- **FR-041**: System MUST define navigation such that a future GRC module can be added as a new
  navigation entry without altering the shell structure or existing modules.
- **FR-042**: System MUST show navigation entries only for capabilities the user is permitted to
  access, and MUST NOT rely on hidden entries as the access control.
- **FR-043**: System MUST present modules that are planned but not implemented as explicitly
  unavailable rather than as broken or empty functional areas.
- **FR-044**: System MUST provide a consistent notification and feedback mechanism for success,
  warning and error outcomes, used uniformly across all screens.
- **FR-045**: System MUST provide consistent patterns for forms, tables, filters, search, dialogs,
  confirmations, status indicators, validation messages, empty states and loading states.
- **FR-046**: System MUST require explicit confirmation for destructive or irreversible actions,
  stating what will happen.

#### GRC Dashboard

- **FR-047**: System MUST present, after authentication, a GRC dashboard as the default landing
  view.
- **FR-048**: System MUST provide dashboard areas for risks, problems, incidents, controls, action
  plans, pending approvals, overdue actions and items requiring review.
- **FR-049**: System MUST populate dashboard areas backed by Risk Management with real data scoped
  to the user's authorization, including the risks area, the pending-approvals area (risk
  acceptance and closure approvals awaiting the user), the overdue-actions area (overdue risk
  treatment actions) and the items-requiring-review area (risks past their next review date).
- **FR-050**: System MUST mark dashboard areas for modules not yet implemented — problems,
  incidents and controls — as planned or unavailable, and MUST NOT display placeholder or
  fabricated values for them.
- **FR-051**: System MUST allow dashboard areas to be added as future modules are implemented
  without redesigning the dashboard.
- **FR-052**: System MUST link dashboard areas to the corresponding filtered views where a
  functional module exists.

#### Risk Record

- **FR-053**: System MUST allow a risk to hold, where applicable: unique identifier, human-readable
  risk code, title, description, category, risk type, origin, organizational unit, responsible
  person, risk owner, related process, related asset, causes, consequences, probability, impact,
  inherent risk, related controls, residual risk, treatment strategy, treatment description,
  treatment deadline, status, identification date, assessment date, next review date, comments and
  attachments.
- **FR-054**: System MUST assign each risk a unique, human-readable code that is stable for the life
  of the record.
- **FR-055**: System MUST require at minimum a title, description, category, organizational unit and
  risk owner before a risk may leave draft state.
- **FR-056**: System MUST allow risks to be saved in an incomplete draft state.
- **FR-057**: System MUST support multiple causes and multiple consequences per risk, each
  individually recorded rather than as a single free-text blob.
- **FR-058**: System MUST allow assignment and reassignment of the risk owner and responsible
  person, recording each change with actor and timestamp.
- **FR-059**: System MUST validate all risk input on the server, independently of interface
  validation.
- **FR-060**: System MUST maintain referential integrity between a risk and the users,
  organizational units and reference data it points to.

#### Risk Methodology and Assessment

- **FR-061**: System MUST hold the risk methodology — the probability scale, impact scale, their
  labels and values, the risk-level matrix and the resulting risk-level bands — as configuration
  rather than as logic embedded in interface components.
- **FR-062**: System MUST derive inherent risk level and residual risk level from the configured
  methodology; users MUST NOT enter derived risk levels directly.
- **FR-063**: System MUST apply risk-level derivation through a single centralized rule set used by
  every part of the platform that displays or filters a risk level.
- **FR-064**: System MUST record each assessment as a distinct record capturing the assessing user,
  assessment date, the factor values supplied, the associated methodology configuration in force,
  the resulting inherent level, the controls considered and the resulting residual level.
- **FR-065**: System MUST preserve all previous assessments when a risk is reassessed, and MUST NOT
  overwrite them.
- **FR-066**: System MUST present the current assessment, previous assessments, the change in risk
  level between them, who assessed and when.
- **FR-067**: System MUST reject assessment factor values that fall outside the configured scales.
- **FR-068**: System MUST version the methodology configuration so that a change to it does not
  retroactively alter the stored results of historical assessments.
- **FR-069**: System MUST present inherent risk and residual risk as clearly distinct concepts in
  the interface, with the relationship between them explained.
- **FR-070**: System MUST record and expose the next review date for a risk and MUST identify risks
  whose review is overdue.

#### Risk Treatment and Controls

- **FR-071**: System MUST support treatment strategies of mitigate, avoid, transfer/share and
  accept.
- **FR-072**: System MUST record for each treatment decision the strategy, description/rationale,
  deadline, deciding user and timestamp.
- **FR-073**: System MUST preserve superseded treatment decisions in history rather than overwriting
  them.
- **FR-074**: System MUST allow treatment actions to be created and managed against a risk, each
  with a description, responsible user, due date and status, owned by the risk record in this
  release.
- **FR-074a**: System MUST record treatment action status changes with acting user and timestamp,
  and MUST audit them.
- **FR-074b**: System MUST identify treatment actions whose due date has passed while their status
  is not complete, and MUST surface them in the risk detail, the register and the dashboard's
  overdue-actions area.
- **FR-074c**: System MUST model treatment actions so that a future shared Action Plans module can
  take ownership of them without changing their recorded meaning or requiring risk records to be
  restructured.
- **FR-075**: System MUST indicate when a treatment deadline has passed with outstanding actions.
- **FR-076**: System MUST allow controls to be associated with and disassociated from a risk, with
  each change audited.
- **FR-077**: System MUST model the risk-to-control relationship explicitly, such that a future
  dedicated Controls Management module can take ownership of controls without changing the
  relationship's meaning or requiring migration of risk data.
- **FR-078**: System MUST make associated controls visible where they influence residual risk.

#### Risk Lifecycle

- **FR-079**: System MUST define an explicit lifecycle for risks with the states draft, identified,
  assessed, under treatment, under review, accepted, closed and archived.
- **FR-080**: System MUST define explicitly which transitions between states are permitted, which
  permission each requires, which preconditions each requires, and which require an approval by a
  user other than the requester.
- **FR-081**: System MUST refuse, on the server, any transition that is not permitted from the
  current state or for which preconditions are unmet, leaving the record unchanged.
- **FR-082**: System MUST offer in the interface only those transitions valid from the current state
  and permitted to the current user.
- **FR-083**: System MUST record for each transition the previous state, new state, acting user,
  timestamp and any justification supplied.
- **FR-084**: System MUST prevent modification of business content on risks in closed or archived
  states while keeping them readable.
- **FR-085**: System MUST ensure that concurrent transition requests on the same risk result in at
  most one applied transition.

#### Risk Register and Detail

- **FR-086**: System MUST provide a risk register listing risks with pagination, and MUST NOT return
  unbounded result sets.
- **FR-087**: System MUST support sorting the register by at least code, title, risk level, status,
  owner and next review date.
- **FR-088**: System MUST support filtering the register by status, risk level, category,
  organizational unit and owner, with filters combinable.
- **FR-089**: System MUST support text search across risk code, title and description.
- **FR-090**: System MUST restrict register results to records within the requesting user's
  authorized organizational scope.
- **FR-091**: System MUST indicate in the register the risk owner, overdue reviews, and high and
  critical risk levels, using indicators that do not rely on color alone.
- **FR-092**: System MUST preserve applied filters, search terms, sorting and page position when the
  user navigates to a risk and returns to the register.
- **FR-093**: System MUST present risk detail in structured sections rather than a single
  undifferentiated form, covering overview, assessment, causes and consequences, controls,
  treatment, action plans, history, audit, attachments and comments.
- **FR-094**: System MUST show in risk detail only the sections the user is authorized to see.

#### Comments, Attachments and Notifications

- **FR-095**: System MUST provide a comment capability that records author and timestamp and is
  attachable to a GRC record, designed for reuse by future modules.
- **FR-096**: System MUST provide an attachment capability that records the uploading user,
  timestamp, original file name, size and type, designed for reuse by future modules.
- **FR-097**: System MUST enforce a configurable allow-list of attachment file types and a maximum
  file size, rejecting anything outside them.
- **FR-098**: System MUST control access to an attachment according to the permissions on its parent
  record, and MUST refuse direct retrieval by unauthorized users.
- **FR-099**: System MUST serve attachments in a manner that prevents their content from being
  executed or interpreted as active content in the user's browser.
- **FR-100**: System MUST audit the addition and removal of comments and attachments.
- **FR-101**: System MUST provide a notification capability able to inform users of events relevant
  to them, structured for reuse by future modules.

#### Data Integrity and History

- **FR-102**: System MUST NOT hard-delete risks, assessments, treatment decisions, lifecycle
  transitions, comments, attachments or audit entries that carry historical traceability; removal
  MUST be represented as an explicit state that preserves history.
- **FR-103**: System MUST detect and surface conflicting concurrent modifications to the same risk
  rather than silently applying last-write-wins.
- **FR-104**: System MUST enforce data integrity constraints — required values, uniqueness and
  referential integrity — at the persistence layer in addition to application validation.
- **FR-105**: System MUST present a risk's history as a chronological, attributed account covering
  assessments, risk level changes, ownership changes, treatment decisions, status changes,
  approvals and other historically relevant field changes.

#### Security, Errors and Extensibility

- **FR-106**: System MUST validate and constrain all input received at its boundaries before it
  reaches business logic.
- **FR-107**: System MUST NOT expose stack traces, internal identifiers, query fragments or other
  internal detail in responses to clients.
- **FR-108**: System MUST NOT record secrets, credentials, session identifiers or confidential
  record content in application logs.
- **FR-109**: System MUST emit distinguishable categories of log output for security events, audit
  events, application errors and operational events.
- **FR-110**: System MUST make the platform capabilities — authentication, authorization, users,
  organizational units, sessions, audit, comments, attachments, notifications, lifecycle handling,
  status handling and search/filter patterns — reusable by future GRC modules without duplication.
- **FR-111**: System MUST keep the platform core free of dependencies on business modules, and MUST
  keep Risk Management free of direct dependencies on modules not yet implemented.
- **FR-112**: System MUST allow a risk to be related, in future, to problems, incidents, controls,
  assets, processes, action plans, compliance requirements and audits without restructuring the risk
  record.

### Key Entities

- **User**: An internal platform identity for a person. Holds name, contact identifier, activation
  status, assigned roles, organizational unit and the authentication method(s) associated with it.
  Independent of any external directory.
- **Authentication Method**: The mechanism by which an identity is verified (local, and in future
  LDAP, Active Directory, OIDC, SAML). Associated with a user; never referenced by business modules.
- **Session**: An authenticated period of use. Holds user, creation time, expiration, last activity,
  IP address, user agent, authentication method and revocation state.
- **Role**: A named set of permissions assignable to users.
- **Permission**: A grantable capability expressed as an action (view, create, edit, delete,
  approve, administer) over a resource type.
- **Organizational Unit**: A node in the organization's structure used to scope both user access and
  record ownership.
- **Audit Event**: An immutable record of a significant operation. Holds actor, timestamp, action,
  entity type, entity identifier, previous values, new values and request/session context.
- **Risk**: The central GRC record. Holds identity and code, descriptive content, classification,
  ownership, organizational placement, current assessment results, treatment, lifecycle status and
  review dates; relates to causes, consequences, controls, assessments, treatment actions, comments
  and attachments.
- **Risk Category / Risk Type / Risk Origin**: Configurable reference data used to classify risks.
- **Risk Cause** and **Risk Consequence**: Individually recorded contributors to and outcomes of a
  risk, belonging to a risk.
- **Risk Methodology**: The versioned configuration defining probability and impact scales, the
  risk-level matrix and risk-level bands used to derive inherent and residual risk.
- **Risk Assessment**: An immutable point-in-time evaluation of a risk. Holds assessor, date, factor
  values, methodology version, derived inherent level, controls considered and derived residual
  level.
- **Risk Treatment Decision**: A recorded decision on how a risk is to be handled. Holds strategy,
  rationale, deadline, deciding user and timestamp; superseded decisions are retained.
- **Treatment Action**: A unit of work arising from a treatment decision. Holds description,
  responsible user, due date and status.
- **Control Reference**: An explicitly modeled association between a risk and a control, prepared to
  be taken over by a future Controls Management module.
- **Lifecycle Transition**: A recorded movement of a risk between lifecycle states. Holds previous
  state, new state, actor, timestamp and justification.
- **Approval**: A recorded request for, and decision on, a transition requiring segregation of
  duties. Holds the target transition, requesting user, deciding user, outcome, timestamp and
  justification. The requesting and deciding users must differ.
- **Comment**: An attributed textual note on a GRC record, reusable across modules.
- **Attachment**: An attributed file associated with a GRC record, with name, size, type and access
  governed by the parent record, reusable across modules.
- **Notification**: A message directed to a user about an event relevant to them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized user can sign in and reach the GRC dashboard in under 10 seconds on a
  standard corporate connection.
- **SC-002**: A risk analyst can create a complete risk record — description, classification,
  ownership and initial assessment — in under 5 minutes without consulting documentation.
- **SC-003**: A risk manager can locate a specific risk among 10,000 records using search and
  filters in under 30 seconds.
- **SC-004**: The risk register returns a page of results in under 2 seconds with 50,000 risk
  records present, for any combination of supported filters, sorting and search.
- **SC-005**: 100% of risk create, edit, assessment, treatment, control association, lifecycle
  transition and access-control operations produce a retrievable audit entry identifying actor,
  time, action, entity and the relevant value changes.
- **SC-006**: 100% of attempts to perform an action without the required permission are refused by
  the server, verified including cases where the interface is bypassed entirely.
- **SC-007**: 100% of reassessments preserve every prior assessment, verified by retrieving all
  historical assessments after repeated reassessment.
- **SC-008**: 100% of attempted invalid lifecycle transitions are refused with the record left
  unchanged.
- **SC-009**: A reviewer can reconstruct a risk's complete evolution — level changes, ownership
  changes, treatment decisions and status changes with actors and dates — from the risk's own views
  in under 2 minutes, without database access.
- **SC-010**: No credential, secret, session identifier, stack trace or internal identifier appears
  in any client response, log entry or audit entry, verified across authentication failures,
  authorization failures and unexpected errors.
- **SC-011**: A new GRC module can be added to the navigation, dashboard, audit, comments and
  attachments capabilities without modifying the application shell or any existing module, verified
  by walking through the extension points with a stub module.
- **SC-012**: The interface meets WCAG 2.1 Level AA for the login, dashboard, risk register and risk
  detail screens, including full keyboard operability and status conveyed by more than color alone.
- **SC-013**: Every dashboard area for a module not implemented in this release is labeled as
  planned or unavailable, with zero fabricated metrics displayed.
- **SC-014**: Automated tests cover authentication, authorization decisions including negative
  cases, organizational scope filtering, segregation of duties on approvals, session lifecycle,
  risk-level derivation including boundary values, lifecycle transitions including invalid ones,
  assessment history preservation, and audit entry generation; all pass.
- **SC-015**: 100% of attempts to read or modify a risk outside the acting user's authorized
  organizational scope are refused, verified including direct requests that bypass the interface.
- **SC-016**: 100% of attempts by a requesting user to approve their own risk acceptance or closure
  are refused, and every approval decision is retrievable with requester, approver, outcome and
  timestamp.

## Assumptions

- **Scope of authentication**: Local username/password is the only operational authentication method
  in this release. LDAP, Active Directory, OIDC and SAML are designed for but not implemented.
- **Multi-factor authentication**: Out of scope for this release; the identity model does not
  preclude adding it.
- **Self-service account recovery**: Password reset by email and self-service registration are out
  of scope; administrators provision users and can reset passwords.
- **User session self-management**: Users viewing and revoking their own active sessions is treated
  as a future capability, per the input; the session model supports it now.
- **Default risk methodology**: A 5×5 probability-by-impact matrix with four risk-level bands (low,
  medium, high, critical) is assumed as the shipped default configuration; it is configuration, not
  a fixed rule, and other scales are supported.
- **Residual risk derivation**: Residual risk is recorded per assessment taking associated controls
  into account; the precise control-effectiveness inputs are part of the configurable methodology
  and will be settled during planning.
- **Controls in this release**: Controls exist only to the extent needed to be referenced from a
  risk. No Controls Management module — control design, testing, effectiveness campaigns — is built.
- **Processes and assets in this release**: A risk may reference a related process and asset as
  lightweight references; no Process or Asset Management modules are built.
- **Organizational structure**: A hierarchical organizational unit tree with each risk assigned to
  exactly one unit is assumed. Multi-tenancy across separate customer organizations is out of scope.
- **Organizational scope enforcement** *(confirmed 2026-09-04)*: Scope is enforced from this release
  on every risk read and write. A global scope grant is available for org-wide roles such as
  auditors and administrators, and a grant on a unit extends to its descendants.
- **Approvals and segregation of duties** *(confirmed 2026-09-04)*: Approval by a user other than
  the requester is required for a risk to enter the accepted state and the closed state. No other
  transition requires approval in this release; further gates are added as lifecycle configuration.
- **Treatment actions** *(confirmed 2026-09-04)*: Treatment actions are owned by the risk record in
  this release. A shared Action Plans module reusable across GRC domains is deferred, and the action
  model is shaped so ownership can move to it later without restructuring risk records.
- **Language and localization**: A single interface language is assumed for this release, with text
  externalized so that localization can be added later. Timestamps are stored in UTC and displayed
  in the user's local time zone.
- **Attachment storage**: Attachments are stored by the platform with a default maximum size of
  25 MB per file and a conservative default type allow-list; both are configuration.
- **Notifications**: In-application notifications only; email or other outbound channels are out of
  scope for this release.
- **Reporting and indicators**: No reporting or indicator module is built; the audit and history
  data model is designed to support them later.
- **Data volumes**: The platform is designed for tens of thousands of risks and millions of audit
  entries per deployment, and the register and audit views are built accordingly.
- **Browser support**: Current versions of mainstream desktop browsers; the interface is usable on
  smaller screens but is optimized for desktop professional use.
- **Seeded configuration**: The release ships with seed data for default roles, permissions, risk
  categories, types, origins, the default methodology, and an initial administrator account whose
  credentials must be changed on first use.

## Out of Scope

The following are explicitly excluded from this release and MUST NOT be implemented:

- Problems, Incidents, Controls, Assets, Processes, Compliance and Audits modules.
- A shared, cross-domain Action Plans module. Treatment actions in this release belong to the risk
  record; the shared module is deferred.
- Indicators and Reports modules.
- Operational LDAP, Active Directory, OIDC or SAML authentication.
- Multi-factor authentication, self-service registration and email-based password recovery.
- Outbound notification channels (email, chat, webhooks).
- Multi-tenancy across separate customer organizations.
- Bulk import/export of risk data.
- Public or partner-facing API for third-party integration.
