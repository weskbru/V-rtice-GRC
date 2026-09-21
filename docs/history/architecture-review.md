# Architecture Review — PharosGRC Platform Foundation (T209)

> **Historical document — point-in-time review (2026-09-06), Phase 001 only.** Does not
> necessarily describe the current state of the product. Current source of truth:
> [`docs/architecture.md`](../architecture.md).

**Date**: 2026-09-06
**Scope**: `specs/001-grc-platform-foundation/plan.md`'s module boundaries and layering;
Constitution Principle I (GRC Domain Integrity — one business concept, one name) and Principle
VIII (Code Quality and Architecture — modularity, layering, no premature abstraction).

**Reviewer stance**: `docs/architecture.md` and `docs/deferred-findings.md` already document that
this project's own claims about its architecture have been wrong twice before — ADR-011 once
claimed seven extension points were "proven" when three did not exist (F-7), and the first SC-011
probe run failed outright (F-22). This review therefore re-derives every claim below from the
current source and, where a design document makes a specific, checkable claim, checks it — rather
than restating the document.

## Headline verdict

**Module boundaries are genuinely, mechanically enforced for the file layout ADR-011 describes,
with one real and consequential blind spot**: the lint rule cannot see a NestJS module's own
composition-root file (`*.module.ts`, `main.ts`, `app.module.ts`) — precisely the file where a
second module's cross-boundary wiring would first appear. **Domain-layer purity holds with one
narrow, consistent exception** (four files import a Prisma enum as a runtime value, not a type).
**Constitution VI's "computed once" rule for derived values does not hold for treatment-action
overdue status**: three independently hand-maintained SQL copies of the same predicate exist (two
of them in the same file, unshared even with each other), plus one undocumented inline
TypeScript reimplementation — a live violation, not a historical one already fixed, and the
project's own comments acknowledge the duplication as a deliberate performance trade-off without
naming it as what it is against Constitution VI. Risk-level classification, by contrast, **is**
genuinely centralized end-to-end and is the correct model to generalize from. `docs/architecture.md`
itself is stale on three specific claims it makes about the current codebase (see §0) — a
reminder that this document, too, will drift the same way if not re-verified at the next review.

---

## 0. `docs/architecture.md` is stale on three claims this review depends on

Before the four requested areas: this review does not treat `docs/architecture.md` as evidence,
because three of its specific, checkable claims are currently false, each because a later commit
landed without the document being updated:

| Doc claim | Actual state, verified by reading the tree |
|---|---|
| "`core/` today has `identity`, `sessions`, `authorization`, `organizations`, `audit`" and no `comments`/`files`/`notifications` directory exists yet | `core/comments/`, `core/files/`, `core/notifications/`, and `core/dashboard/` all exist today, fully layered, landed in commit `69c4cdc` (US9 backend) and `475aa0d` (dashboard) — both before the document's last edit |
| "Searching `modules/risk/domain` finds no `risk-lifecycle.ts`, no `transition-preconditions.ts`, no `Approval` handling" | Both files exist (`domain/risk-lifecycle.ts`, `domain/transition-preconditions.ts`), plus `domain/approval.ts` and the full approvals use-case/controller stack, landed in commit `896e425` (US6 backend), also before the document's last edit |
| The dashboard has no registry analogous to the navigation registry; aggregates are "not yet built" | `core/dashboard/domain/planned-area-registry.ts` exists, and `dashboard-query.service.ts`/`get-dashboard.usecase.ts` implement real, working SQL aggregates |

This does not mean the document's *conclusions* are wrong — SC-011's verified status and the
extension-point inventory are, independently, still accurate — but its "known gaps" section
currently describes gaps that have already been closed. Everything below is re-derived from the
current source rather than taken from this document.

---

## 1. Module boundaries (ADR-011)

### 1.1 The rule exists, is well-scoped, and is real enforcement — **verified by execution**

`apps/api/eslint.config.mjs` configures `eslint-plugin-boundaries` with ten element types matching
`shared/**`, `infrastructure/**`, `core/(capability)/{domain,application,infrastructure,presentation}/**`
and `modules/(module)/{domain,application,infrastructure,presentation}/**`, `default: "disallow"`
(every legitimate direction must be explicitly allowed), plus an explicit, redundant `disallow`
policy restating "core must never import modules" so it cannot be silently reopened by an earlier,
broader `allow`. Confirmed this classification matches the real tree (every `core/<capability>`
and the one `modules/<module>` that exists has exactly these four subfolders).

Confirmed the rule actually fires, by executing it directly (via `eslint --stdin`, nothing written
to disk) against a file inside a classified layer:

```
$ printf "import { RiskEntity } from '../../../modules/risk/domain/risk.entity'; ..." \
    | npx eslint --stdin --stdin-filename src/core/organizations/domain/org-unit-path.ts
src/core/organizations/domain/org-unit-path.ts
  1:28  error  core/** must never import from modules/** (ADR-011)  boundaries/dependencies
```

### 1.2 Real, verified gap: composition-root files are outside the ruleset — **confirmed by execution**

Every capability's and module's NestJS composition root — `core/<capability>/<capability>.module.ts`,
`modules/<module>/<module>.module.ts`, plus `src/main.ts` and `src/app.module.ts` — sits one level
above the four classified subfolders and matches **none** of the ten `boundaries/elements`
patterns. `eslint-plugin-boundaries` skips the `boundaries/dependencies` check entirely for a file
whose own element type is unrecognized (confirmed by reading the plugin's own
`DependencyRule.js`: `if (entity.file.isIgnored || (entity.file.isUnknown && entity.element.isUnknown)) return {}`
— no visitors registered, the rule never runs for that file). Verified this empirically, twice
independently (once by the investigating sub-review, once by this reviewer):

```
$ printf "import { RiskEntity } from '../modules/risk/domain/risk.entity';\nexport const x = RiskEntity;\n" \
    | npx eslint --stdin --stdin-filename src/core/organizations/organizations.module.ts
src/core/organizations/organizations.module.ts
  2:14  error  Unsafe assignment of an error typed value  @typescript-eslint/no-unsafe-assignment
```

Zero `boundaries/dependencies` error for a textbook `core/** importing modules/**` violation,
placed in exactly the file a real `core` capability's composition root would contain. The only
error that fires is an unrelated type-safety rule, incidental to the deliberately-broken test
import, not the boundary check.

**Why this matters beyond a lint technicality**: `docs/architecture.md`'s own worked example for
adding a second module (step 7, cross-module relationships) asserts confidently that "the lint
config [will] fail loudly if that boundary is crossed by accident." That claim is only true for
code inside a module's `domain/application/infrastructure/presentation` subfolders. The one file
every future module's cross-module wiring will actually live in — its own `*.module.ts`
constructor, exactly where `RiskModule` today imports `AuditModule`/`OrganizationsModule` and
where a careless second module might one day import a sibling module's domain directly — is
precisely the file type this mechanism cannot see. A violation introduced there would be caught
only by human review, not by CI. **Severity: Medium** (this is the layer's own stated safety net
failing exactly where module boundaries are most likely to be tested for real, on the second
module). **Recommendation**: add an element-type pattern matching `src/{core,modules}/*/*.module.ts`
and `src/{main,app.module}.ts` (or fold composition roots into an existing layer, e.g. treating
them as `*-infrastructure`) so the same `core`→`modules` and `modules/a`→`modules/b` disallow
rules apply there too.

### 1.3 No inappropriate exclusions otherwise — **verified**

The rule's `files: ['src/**/*.ts']` scope is broad, not narrowly carved to exclude a subtree that
should be covered — the gap in §1.2 is a classification gap (files matching no element type), not
a deliberate `ignores` exclusion.

### 1.4 Wired into the real lint/CI command, currently passing — **verified by execution**

`apps/api/package.json`'s `lint` script includes `src/**/*.ts`; the root `lint` script runs it via
`pnpm -r`; `.github/workflows/ci.yml`'s `lint` job runs `pnpm run lint` with a comment explicitly
naming this as covering "the core/ vs modules/ import boundary rules (ADR-011)," and gates the
integration/contract test jobs on it. Ran it directly in this review:

```
$ pnpm --filter @pharos/api run lint
(no output, exit 0)
```

### 1.5 Frontend has no equivalent tool enforcement — **verified**

No `eslint-plugin-boundaries` configuration exists anywhere for `apps/web` or
`packages/design-system` (confirmed by grepping the whole repository for the plugin name and the
rule id — the only hits are `apps/api/eslint.config.mjs` and the root `package.json`'s dependency
list). This matches `docs/architecture.md`'s own stated limitation and is not, today, a live
problem: `apps/web/src/features/` has exactly one business feature (`risks`) plus two
shell-adjacent ones (`admin`, `dashboard`), so there is currently nothing for a frontend boundary
rule to have caught. This is an untested claim, not a demonstrated one, in the same sense
ADR-011's "modules/a cannot import modules/b" rule is untested on the backend until a second
module exists (§4).

---

## 2. Domain layer purity

Grepped every file under `modules/risk/domain/**` and every `core/*/domain/**` for
`@nestjs/`, `@prisma/client`, `fs`, `http`, `express` imports, and separately for
`@Injectable`/`@Inject` decorators.

- **`@nestjs/`, `fs`, `http`, `express`: zero hits.** **`@Injectable`/`@Inject`: zero hits** — the
  one match was a comment in `risk-scoring.service.ts` explaining why the class deliberately has
  no `@Injectable()` (it needs no DI). Domain code is genuinely free of NestJS/HTTP/filesystem
  coupling.
- **`@prisma/client`: two distinct categories.** The large majority (confirmed ~25 occurrences)
  are `import type { RiskLevel, RiskStatus, PermissionAction, AuthenticationMethod, ... }` — erased
  entirely at compile time, and the repository's own `@typescript-eslint/consistent-type-imports`
  rule (with `fixStyle: 'separate-type-imports'`) forces this style, so a value import cannot
  silently masquerade as a type import. This is a defensible, documented pattern (treating a
  closed Prisma enum as a shared vocabulary type, not a runtime ORM dependency) and is **not** a
  violation.
- **Genuine, narrow violation — verified, four files**: `modules/risk/domain/risk-audit-allowlist.ts`,
  `core/audit/domain/core-entity-audit-allowlists.ts`, `core/comments/domain/comments-audit-allowlist.ts`,
  and `core/files/domain/files-audit-allowlist.ts` all `import { AuditEntityType } from '@prisma/client'`
  as a **value** (`AuditEntityType.RISK`, `.USER`, etc.), not a type. Prisma generates enums as
  real JS objects, not erased types, so these four domain files have an actual runtime dependency
  on the generated `@prisma/client` package. **Severity: Low** — a closed enum, not a query,
  connection, or any I/O — but it is a real breach of "domain rules MUST NOT depend on ... ORM ...
  details" read literally, and it is **inconsistent with the project's own stated practice
  elsewhere in the same module**: `risk-scoring.service.ts`/`methodology.schema.ts` deliberately
  hand-roll their own `RiskLevelValue` union specifically to avoid this exact coupling for
  `RiskLevel` (see §3.3), while `AuditEntityType` was not given the same treatment. Owner:
  whichever future module next touches the audit-allowlist registration pattern should either
  hand-roll an equivalent domain-level enum for `AuditEntityType`, or make an explicit, documented
  decision that this one enum is exempt (it is used purely as a fixed identifier set, arguably
  closer to a language keyword than an ORM detail) — but that decision does not currently exist in
  writing anywhere, which is itself worth fixing regardless of which way it is resolved.

---

## 3. One business concept, one name (Constitution I) / derived values computed once (Constitution VI, ADR-006)

### 3.1 `overdueTreatment` / treatment-action overdue status — **live violation, not historical, verified**

The domain function is real: `modules/risk/domain/risk-overdue.ts` exports `isOverdueTreatmentAction`
and `isOverdueReview`, both pure, both documented as "the ONE place this predicate is evaluated
**in TypeScript**." That qualifier is exact and load-bearing, because the SQL side is a separate,
hand-maintained implementation, not a call into this function:

- **`modules/risk/infrastructure/risk-query.service.ts`**'s `overdueTreatmentExistsFragment`
  (verified directly) hand-writes `EXISTS (SELECT 1 FROM risk_treatment_actions rta WHERE
  rta.risk_id = r.id AND rta.status NOT IN ('COMPLETED', 'CANCELLED') AND rta.due_on < today)` for
  the register's `overdueTreatment` field and filter.
- **`modules/risk/infrastructure/dashboard-query.service.ts`** hand-writes the **identical**
  predicate **twice within the same file**, independently — once in `getOverdueActions`
  (`rta.status NOT IN ('COMPLETED', 'CANCELLED') AND rta.due_on < ${todayParam}::date`, confirmed
  by reading the method directly) and again in `getTreatmentActionsSummary`'s `COUNT(*) FILTER`
  clause, with no shared local helper between the two, let alone a shared one with
  `risk-query.service.ts`.
- **`modules/risk/presentation/dto/treatment-decision-response.mapper.ts`** reimplements a
  close relative of the same idea inline and undocumented:
  `record.deadline !== null && record.deadline.getTime() < todayDateOnlyUtc().getTime()` — this
  reuses the domain layer's `todayDateOnlyUtc()` helper but recomputes the comparison itself
  rather than calling `isOverdueReview(record.deadline ?? undefined)`, which computes the
  identical expression. Unlike the SQL fragments, this one carries no comment acknowledging it is
  a duplicate.

That is **four** independent implementations of one predicate: one canonical (TypeScript, tested,
`risk-overdue.spec.ts`), three uncoordinated copies. The project's own header comments in both SQL
files openly acknowledge the cross-file duplication as "documented parity" — a real, honestly-
disclosed engineering trade-off for query performance at 50,000-row scale, since PostgreSQL cannot
call a TypeScript function inside a `WHERE`/`FILTER` clause — but the comments do not name this
as what Constitution VI actually prohibits ("Duplicating calculation logic in the API, UI, reports
or database is prohibited... belongs in a domain service, not duplicated at each call site"), and
the *intra-file* duplication in `dashboard-query.service.ts` (the same predicate twice in one
file) has no performance justification at all — it is simply not shared even with itself.

Mitigating evidence: one contract test (`risk-detail.spec.ts`) asserts output-level parity between
`overdueTreatment` and `treatmentActionSummary.overdue > 0` for one scenario — real coverage, but a
single example, not a proof of agreement across every status/date combination the four
implementations could diverge on.

**Verdict**: this is a genuine, current Constitution VI violation, not one already resolved and
merely under-documented. **Severity: Medium** — the risk is exactly what Constitution VI's
rationale names (a value that "cannot be reproduced or explained after the fact is worse than no
value"): a future change to the terminal-status set (`COMPLETED`/`CANCELLED`) requires editing
four call sites by hand, and nothing in the type system or test suite would catch a missed one
except the single example-based contract test. **Recommendation**: either (a) accept the SQL/TS
split as a documented, permanent architectural exception with a single canonical SQL fragment
shared by both `risk-query.service.ts` and `dashboard-query.service.ts` (closing the
intra-file duplication, which has no performance excuse), backed by a property-style test that
generates the predicate's truth table and asserts the TypeScript and SQL answers agree for every
combination, not just one page's worth of fixture data; or (b) route the presentation-layer
mapper's inline comparison through `isOverdueReview` so at least the TypeScript side has exactly
one implementation. Owner: whoever next touches `modules/risk/infrastructure/dashboard-query.service.ts`
or the treatment-action terminal-status list.

### 3.2 Frontend — genuinely clean, verified

Every frontend file consuming an overdue flag (`treatment-actions-table.tsx`,
`risk-review-schedule.tsx`, `overdue-actions-list.tsx`, `treatment-actions-chart.tsx`) carries an
explicit comment stating the value is the server's answer and is never recomputed client-side, and
no arithmetic re-deriving overdue status from raw dates was found anywhere in `apps/web/src`. The
duplication identified above is entirely backend-side.

### 3.3 Risk level classification (probability × impact → LOW/MEDIUM/HIGH/CRITICAL) — **genuinely centralized, the model to generalize from**

`RiskScoringService.score()` (`modules/risk/domain/risk-scoring.service.ts`) is the only place a
level is ever derived from a matrix cell and level bands; it has exactly one call site
(`CreateAssessmentUseCase`). The result is persisted to `risks.residual_level`/`inherent_level`,
and every reader — the register (`risk-query.service.ts`, a column reference:
`r.inherent_level`/`r.residual_level`) and the dashboard (`dashboard-query.service.ts`,
`COUNT(*) FILTER (WHERE r.residual_level = 'LOW')`) — reads that stored column rather than
recomputing. Grepped for any `CASE WHEN`-shaped threshold logic touching risk level/score anywhere
in `apps/api/src`: zero hits outside `RiskScoringService` itself. The frontend renders the
server-supplied methodology matrix and level bands verbatim
(`methodology-mapping.ts`: "ADR-006: scoring is never performed in the browser") and never
computes a level client-side. **This is the one derived-value case in the codebase that is
centralized end-to-end**, and it directly contradicts any inference that the architecture cannot
sustain Constitution VI in practice — §3.1's finding is a specific, local lapse, not evidence the
pattern is unachievable here.

### 3.4 A claimed test that does not appear to exist — **flagged, not confirmed**

`methodology.schema.ts`'s header states its hand-rolled `RiskLevelValue` union (kept deliberately
separate from Prisma's `RiskLevel` enum to avoid the coupling named in §2) is "kept
string-identical to Prisma's `RiskLevel` enum by hand (**verified in this file's own test**)."
Searched `apps/api/test/unit` for a test importing both `RiskLevelValue`/`RISK_LEVEL_VALUES` and
Prisma's `RiskLevel` to assert they agree: no such test exists. The closest files
(`risk-scoring.spec.ts`, `risk-scoring-validation.spec.ts`) import `RiskLevelValue` but never
import `@prisma/client`'s `RiskLevel` for comparison. **This specific claim, read literally, does
not currently hold** — if the two unions were ever to drift (someone adds a value to the Prisma
enum without updating the hand-rolled one, or vice versa), nothing in the test suite that this
review could find would catch it before it reached production. **Severity: Low** (both unions are
stable, closed, four-value sets that are unlikely to change without deliberate action) but the
gap between "the comment says this is tested" and "no such test exists" is exactly the pattern
this project's own review culture (`docs/deferred-findings.md`) exists to catch. Owner: whoever
next touches `methodology.schema.ts` — add the missing equality assertion (a one-line
`expect(RISK_LEVEL_VALUES).toEqual(Object.values(RiskLevel))`-shaped test) or correct the comment.

---

## 4. Cross-module relationship pattern

Grepped every file under `modules/risk` (excluding tests) for imports from `modules/*` and
`core/*`. **Zero imports from any other `modules/*` path** — there is currently no second business
module, so this checks only that Risk Management's own code does not violate the rule against
itself, not that the rule survives contact with a genuinely independent second module (the same
honest caveat `docs/architecture.md` itself makes). **20+ imports from `core/*`**, spanning
`core/audit`, `core/authorization`, `core/organizations`, `core/identity`, `core/sessions`, and —
notably, since `docs/architecture.md`'s prose never mentions them (§0) — `core/comments`
(`risk-parent-record-accessor.ts`) and `core/dashboard` (`get-dashboard.usecase.ts` imports
`getPlannedAreas` from `core/dashboard/domain/planned-area-registry.ts`). This is consistent with,
and an unremarked extension of, the allowed `modules → core` edge — not a violation.
`risk.module.ts`'s composition root imports `AuditModule`/`AuthorizationModule`/`OrganizationsModule`/
`PrismaModule` directly, matching `docs/architecture.md`'s specific citation.

**Verdict**: `modules/risk` currently complies with "depend on core, never on another module."
As above, this is unexercised against a real second module, and — per §1.2 — the one file where a
violation would first plausibly appear (a second module's own composition root) is exactly the
file the lint rule does not check today.

---

## 5. SC-011 — independent assessment

`docs/architecture.md`'s status note and F-23 record that SC-011 (a new module can be added
without editing `core/`, the shell, or Risk Management) passed on its **third** attempt: ADR-011
first falsely claimed extension points existed that didn't (F-7), the first genuine probe run
failed (F-22, two extension points had to be rebuilt as real registries), and the second probe
run passed, exercising real HTTP against real PostgreSQL and touching exactly one file outside its
own tree (the navigation-registry entry). F-23 names three residual costs the probe did not pay
as a permanent module would: a closed-count test assertion (fixed), a structural Prisma
one-sided-relation requirement (accepted, unavoidable), and — named as "the real remaining gap" —
the pt-BR message catalog having no per-module extension mechanism, so a real module must either
break the centralization rule (D-8/Constitution X) or edit a shared file.

**This review's independent view, having re-derived rather than restated the claim**: the pass
verdict is credible for what it actually tested — the permission-definition registry, the
audit-field-allowlist registry, the scoped-repository base, and the navigation registry are all
real, working extension points, confirmed in this review by tracing their call sites directly
(§4, and the security review's §3.3 scope-bypass sweep, which independently confirms the scoped-
repository base is used correctly everywhere it applies today). **But two qualifications this
review adds, neither of which the SC-011 status note surfaces**:

1. **The claimed safety net has a hole exactly where a second module is most likely to make its
   first mistake.** SC-011's probe deliberately touched only files inside classified layers plus
   one registry entry — it never exercised what happens when a module's own `*.module.ts`
   imports something it shouldn't, because a well-behaved probe module has no reason to do that.
   §1.2 shows the lint rule would not catch it if a real, less careful module did. The probe's
   "zero edits outside its own tree" result is genuine evidence the *registries* work; it is not
   evidence the *lint safety net* would catch a violation in the one place SC-011's own worked
   example says it would.

2. **The pt-BR catalog gap is not a residual inconvenience; it means SC-011 does not hold for one
   of the platform's own permanent, constitutionally-mandated rules.** F-23 already says this
   plainly ("SC-011 holds for everything except the one rule this project treats as permanent")
   and this review's independent reading of the same evidence (`apps/api/src/shared/messages/user-messages.ts`
   as one large shared file, Risk Management's strings already occupying a `risk:` block inside
   it, no per-module registration mechanism analogous to the other four) agrees without
   qualification. A second module's implementer faces a genuine, undocumented choice between
   violating D-8/Constitution X (a hardcoded or per-module-inline string) or editing platform-core
   shared state — which is precisely the coupling SC-011 exists to eliminate. This is not a
   theoretical risk: the probe module itself took the D-8-violating shortcut once, by its own
   admission (F-23, item 3).

**Conclusion**: SC-011 genuinely holds for four of the platform's extension points, conditionally
holds for the boundary-enforcement guarantee (real for the layers it checks, silent for
composition roots), and does **not** hold for the pt-BR message catalog. "Passed on the third
attempt, with three residual costs" is the right level of honesty for the status note to have
recorded; this review's addition is that the *lint* half of the story deserves the same treatment
the *registry* half already received — verified where it was tested, not verified where it wasn't.

---

## 6. Where the implementation diverged from the plan, and whether each divergence was sound (D-1..D-15)

All fifteen coordinator decisions in `docs/local-environment.md` were read and assessed. The
review's overall observation is that this decision log is unusually well-disciplined: every entry
states the forcing constraint, the decision, the rationale, and the accepted consequences
explicitly — none were found that weaken a control **silently**. Two are worth flagging as real,
openly-acknowledged trade-offs rather than pure wins, and one is already the security review's own
subject:

- **D-1 through D-7, D-15** (Docker/environment fixes, Node version, test-database routing,
  canonical env-var naming, the auth-rate-limit split, `createdAt`/`updatedAt` reconciliation, and
  the four deliberately-modified shadcn primitives): reviewed, each is a sound, narrowly-scoped
  fix or naming reconciliation with a documented rationale; D-6 in particular *improves* on the
  original single-variable design rather than weakening it (FR-008 genuinely needs two
  dimensions, and a single low shared threshold would have been a usability defect, not a security
  one, if left as originally drafted). D-15's rule that `apps/web/src/components/ui/` may no
  longer be regenerated wholesale is a real, necessary constraint the team imposed on itself after
  finding a genuine accessibility regression (focus not returning on dialog close) — sound.
- **D-8** (pt-BR interface language, permanent): a product decision, not an architectural
  weakening; correctly identified by this review (§5) as the one dimension where SC-011 does not
  yet hold.
- **D-9** (no separate test runner for `packages/design-system`): an **honest, accepted coverage
  gap**, not a silent one — the package cannot be validated in isolation from `apps/web`, and the
  decision log says so plainly, with an explicit condition for revisiting it (a second consumer
  appearing). Sound as a scoping decision; worth remembering as real technical debt, not
  forgetting because it was labeled a "decision."
- **D-10** (labels-prop convention for design-system strings): sound direction, but the review
  notes it does not by itself close the related, already-recorded **F-1** (enum-mirroring label
  maps typed as `Record<string, string>` rather than against the real union) — the two are
  adjacent, and D-10's fix does not substitute for F-1's.
- **D-11** (every endpoint carries a contract test regardless of whether a task sheet asks for
  one): the strongest decision in the log. It was forced by a real, embarrassing gap (10 of 21
  endpoints had zero tests, one of which — `GET /risk-methodology` — returned 403 to every caller
  and had never worked), and this review independently re-ran that endpoint's regression test live
  (security review §4.3/§11) and confirmed it now passes. This decision is a genuine architectural
  strengthening, not a divergence that cost anything.
- **D-12** (the risk audit controller living in `modules/risk`, not `core/audit` as the task sheet
  named): correctly derived from ADR-011's own constraint (`core` cannot import `modules`, and
  distinguishing 404-from-scope vs 403-from-permission needs the risk's current organizational
  unit). This review's own reading of `list-risk-audit-events.usecase.ts` (security review §3.3)
  confirms the reasoning holds and the resulting code is correct. The general principle D-12
  states — "where a task sheet's path contradicts an ADR, the ADR wins" — is exactly right and is
  a decision this review endorses as a precedent for future modules.
- **D-13** (no self-permission-ownership check on role/scope administration): reviewed in depth
  in the security review (§3.4), which independently confirms D-13's own reasoning is sound as
  specified, with compensating controls (seeded-only administrative permissions, full audit trail)
  verified present rather than assumed. Not repeated in full here to avoid duplication; see
  `docs/history/security-review.md` §3.4.
- **D-14** (`packages/api-types` generated from hand-authored contracts, not the reflected OpenAPI
  document): sound and honestly framed — the alternative (annotating every DTO with `@ApiProperty`)
  would have declared every field's shape twice with nothing keeping the two synchronized, a worse
  trade. The consequence — `openapi.json`/`openapi:check` are a route-level drift detector only,
  not a field-level one — is loudly documented (F-3) rather than smoothed over, and D-11's
  contract-test discipline is explicitly named as what compensates for it. This is a real
  limitation that was **not** quietly accepted; it was named and given a compensating control in
  the same decision.

**No decision in this log was found to quietly weaken a control.** The closest candidates (D-9's
coverage gap, D-14's route-vs-field-level distinction) are both explicitly disclosed in the same
document that makes the decision, with the accepted consequence stated in writing — which is the
standard this review is applying throughout, not a lower one for the coordinator's own decisions.

---

## 7. Summary of findings

| # | Area | Severity | Status |
|---|------|----------|--------|
| 1 | `eslint-plugin-boundaries` cannot see composition-root files (`*.module.ts`, `main.ts`, `app.module.ts`) — a real ADR-011 violation placed there would not be caught by CI | **Medium** | Confirmed by execution (twice, independently) |
| 2 | Four domain files import `AuditEntityType` from `@prisma/client` as a runtime value, not a type — a narrow, inconsistently-applied domain-purity breach | Low | Confirmed |
| 3 | `overdueTreatment`/treatment-action-overdue predicate: 3 independent hand-written SQL copies (2 in one file) + 1 undocumented inline TS reimplementation, despite a canonical domain function existing | **Medium** | Confirmed, live (not historical) |
| 4 | `methodology.schema.ts` claims a same-file test proves `RiskLevelValue`/Prisma `RiskLevel` stay in sync; no such test exists | Low | Confirmed absent |
| 5 | SC-011's "lint will fail loudly" guarantee does not hold for composition-root wiring, and does not hold at all for the pt-BR message catalog (per F-23, independently confirmed) | Medium (documentation honesty gap, not a code defect) | Confirmed |
| 6 | Risk-level classification is genuinely centralized end-to-end | — | Verified as compliant (positive finding, included as the model to generalize from) |
| 7 | Coordinator decisions D-1 through D-15 | — | All sound; none found to weaken a control silently |

## 8. Verified by execution vs. inspected only

**Verified by execution**: the `boundaries/dependencies` rule firing correctly for a classified
file; the same rule's silence for an unclassified composition-root file (the review's central
finding, reproduced independently of the investigating sub-review); `pnpm --filter @pharos/api run lint`
passing clean; the absence of `eslint-plugin-boundaries` anywhere in `apps/web`/`packages/design-system`
(a grep across the whole repository, not an assumption).

**Inspected only**: domain-layer import purity (grepped and read, not executed against a runtime
boundary check beyond what §1 already covers); the `overdueTreatment` duplication across
`risk-overdue.ts`, `risk-query.service.ts`, `dashboard-query.service.ts` and the treatment-decision
mapper (read directly, cross-referenced by two independent readings, not proven-by-test to diverge
in an actual scenario); the risk-level centralization claim (read every writer and reader,
grepped for `CASE WHEN` classification logic, found none — a negative result from a search, not a
runtime trace); the `docs/architecture.md` staleness claims (confirmed via `git log`/`find` against
the actual tree, not by re-running any tool); the D-1..D-15 assessment (read in full, judged
against the rest of this review's own findings, not independently re-derived from source for every
one of the fifteen).

## 9. What this review could not check

- Whether `modules/a` genuinely cannot import `modules/b` in practice — untestable until a second
  business module exists; the rule's *configuration* was verified sound for the module that does
  exist, but ADR-011's cross-module isolation claim remains, as `docs/architecture.md` itself
  admits, unexercised.
- Whether the four hand-written SQL copies of the overdue-treatment predicate currently agree with
  the TypeScript domain function for every input — no property-based or exhaustive test exists to
  check this; the finding in §3.1 is that the risk of silent drift exists, not that drift has
  already happened.
- Whether apps/web's lack of a boundaries lint would matter in practice — there is currently only
  one real business feature on the frontend, so there is nothing for such a rule to have caught
  yet either way.
