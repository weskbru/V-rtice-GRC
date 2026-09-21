/**
 * T042 — the platform seed (data-model.md §14, FR-021/FR-022/FR-025a,
 * spec.md's "Seeded configuration" assumption).
 *
 * Seeds, always, idempotently:
 *   1. Every permission from `getAllPermissionDefinitions()` — never a
 *      hand-copied list (ADR-003).
 *   2. The six system roles (data-model.md §3) with `isSystem = true` and
 *      their permission assignments.
 *   3. The root organizational unit, with a correctly materialized `path`
 *      and `depth` (ADR-004, data-model.md §4).
 *   4. One bootstrap `Platform Administrator` account from
 *      `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (`AppConfigService.seed`),
 *      `mustChangePassword = true`, with a `GLOBAL` organizational scope
 *      grant — the account data-model.md §14 requires ("one administrator
 *      account whose password must be changed on first sign-in").
 *
 * Seeds, ONLY when `SEED_DEV_FIXTURES=true` AND `NODE_ENV !== 'production'`
 * (see `assertDevFixturesAllowed` — this is the "robust guard", not a bare
 * `if`, described in the module's own doc comment below):
 *   5. One user per system role, and a two-level organizational unit tree
 *      hanging off the root, so later stories can be validated end-to-end
 *      (T042's own task text).
 *
 * ## Idempotency
 *
 * Every entity keyed on its natural unique column is upserted:
 * `Permission.identifier`, `Role.name`, `OrganizationalUnit.code`,
 * `User.email`. Join rows (`RolePermission`) are reconciled to an exact
 * set (missing assignments inserted, stale ones removed) rather than only
 * ever inserted, so a change to a role's intended permission set here is
 * also idempotent across repeated runs — not merely "safe to run twice",
 * but "converges to the current definition on every run".
 *
 * The one deliberate exception: a `LocalCredential` is created ONLY if
 * none exists yet for that user (see `ensureLocalCredential`) — an
 * existing credential's `passwordHash`/`mustChangePassword` are NEVER
 * touched by a re-run. Re-seeding a live environment must never silently
 * reset an administrator's (or a developer's) already-changed password
 * back to the seed default; that would be a serious, silent security
 * regression disguised as routine idempotent seeding.
 *
 * ## No real secret
 *
 * Every password seeded here comes from `AppConfigService.seed` (backed by
 * `SEED_ADMIN_PASSWORD`), never a literal in this file. `SEED_ADMIN_PASSWORD`
 * has no schema default (`env.schema.ts`: "an absent seed password must
 * fail the seed script itself") — `requireAdminPassword` below is that
 * failure, thrown before any write. Development fixture users
 * (gated separately, see above) reuse the SAME configured password rather
 * than a second, invented one: no second env var is introduced beyond
 * `SEED_DEV_FIXTURES`, which the task specifies as "already in
 * `.env.example`", and every fixture account carries `mustChangePassword
 * = true` regardless.
 *
 * ## Why seed operations do NOT write to `audit_event` (a deliberate
 * decision, not an oversight)
 *
 * `AuditRecorder.record(...)` requires an acting user (denormalized into
 * `actorLabel`, and `actorUserId` is populated from the ambient
 * `RequestContextStore` when one exists — ADR-005/ADR-012). A seed script
 * runs before any application request, any session, and in the case of the
 * very first run, before any `User` row exists at all: there is no actor
 * to attribute a "role created" event to that would not be fabricated. A
 * "SYSTEM" pseudo-actor is deliberately not invented for this — it would
 * be indistinguishable, on later inspection, from a genuine platform
 * action taken by a real identity, undermining the evidentiary value
 * `audit_event` exists for (ADR-005). Two things preserve accountability
 * for what the seed does without misusing the audit trail: (1) this
 * module is version-controlled — its diff over time IS the record of what
 * seeding changed and why (`git log` on this path), and (2) every
 * post-seed CHANGE made by an authenticated operator through the real
 * application (editing a role's permissions, creating another user) goes
 * through `AuditRecorder` exactly as normal, because that action has a
 * real actor. If a later phase needs certain seed-time facts inside the
 * evidentiary trail itself, the correct fix is a dedicated system-actor
 * design reviewed on its own merits — not a convenient fake `actorUserId`
 * invented here.
 */
import { randomUUID } from 'node:crypto';

import {
  OrgScopeType,
  OrgUnitStatus,
  UserStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import * as argon2 from 'argon2';

import {
  computeChildPath,
  computeRootPath,
  type OrgUnitPathInfo,
} from '../../src/core/organizations/domain/org-unit-path';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

import type { PermissionIdentifier } from '../../src/core/authorization/domain/permissions';
import type {
  AppConfigService,
  Argon2Settings,
} from '../../src/infrastructure/config/app-config.service';

// ---------------------------------------------------------------------------
// System role definitions (data-model.md §3)
// ---------------------------------------------------------------------------

interface SystemRoleDefinition {
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionIdentifier[];
  /** Whether a user provisioned into this role should also receive a
   * `GLOBAL` organizational scope grant (FR-025a) — true only for roles
   * whose whole purpose is platform- or organization-wide, never as a
   * default. Scope is a per-USER grant in this schema (`OrgScopeGrant` has
   * no `roleId`), so this is a provisioning convention this seed applies
   * consistently, not a property the schema itself encodes. */
  readonly globalScope: boolean;
}

const ALL_PERMISSION_IDENTIFIERS: readonly PermissionIdentifier[] =
  getAllPermissionDefinitions().map((definition) => definition.identifier as PermissionIdentifier);

/**
 * Every role and its permission set. `Risk Analyst` and `Risk Approver`
 * are deliberately disjoint on `risk:approve`/`risk:transition` so
 * segregation of duties is administrable (FR-029a) — see data-model.md §3.
 * `Auditor` is read plus `audit:view`, `globalScope: true` per that same
 * section's explicit parenthetical.
 */
export const SYSTEM_ROLE_DEFINITIONS: readonly SystemRoleDefinition[] = [
  {
    name: 'Platform Administrator',
    // F-32 — design rationale that used to live INSIDE the persisted
    // `description` (and therefore on the administrator's screen), moved
    // here: this role is seeded with every permission in the catalogue, but
    // it is an ordinarily-administered role — NOT a hard-coded superuser
    // bypass. `PermissionGuard` resolves it through the same
    // role→permission join as any other role, so revoking a permission from
    // it actually revokes it. Nothing in the codebase short-circuits on this
    // role's name.
    description:
      'Acesso administrativo completo à plataforma: usuários, papéis, unidades organizacionais, ' +
      'configuração da metodologia e todas as operações dos módulos GRC.',
    permissions: ALL_PERMISSION_IDENTIFIERS,
    globalScope: true,
  },
  {
    name: 'Risk Manager',
    // F-32 — rationale moved out of the persisted description: the exclusion
    // of `risk:approve` is the same segregation of duties (FR-029a) that
    // separates Risk Analyst from Risk Approver below. Whoever treats and
    // transitions a risk does not decide the approval that transition needs.
    description:
      'Opera o registro de riscos de ponta a ponta — captura, avalia, trata e transiciona riscos, ' +
      'com comentários e anexos. Não decide aprovações nem administra a plataforma.',
    permissions: [
      'risk:view',
      'risk:create',
      'risk:edit',
      'risk:assess',
      'risk:treat',
      'risk:transition',
      'comment:create',
      'comment:delete',
      'attachment:create',
      'attachment:delete',
      // 002-shared-grc-foundation/US1 — the full evidence lifecycle mirrors
      // this role's own risk:treat authority: a Risk Manager records the
      // decision AND the proof that sustains it (spec.md US1's own
      // scenario), and may archive evidence that has served its purpose.
      'evidence:view',
      'evidence:create',
      'evidence:edit',
      'evidence:administer',
      'evidence:link',
      // 002-shared-grc-foundation/US2 — the full action lifecycle mirrors
      // this role's own risk:treat authority: a Risk Manager is exactly who
      // creates risk-treatment work (via the risk module's own
      // treatment-actions route, AND directly via POST /actions for any
      // RISK_TREATMENT origin they hold risk:treat on) and moves it through
      // its lifecycle.
      'action:view',
      'action:create',
      'action:edit',
      // 002-shared-grc-foundation/US3 — a Risk Manager records findings,
      // edits their descriptive fields as understanding develops, and
      // archives ones that have already been closed (the same
      // create/edit/administer shape already granted for evidence above).
      // Deliberately EXCLUDES `finding:close`: closing is a segregation-
      // of-duties decision (FR-025), and this role already runs the
      // day-to-day remediation work a finding's own actions require — the
      // same reason this role holds `risk:treat` but not `risk:approve`.
      'finding:view',
      'finding:create',
      'finding:edit',
      'finding:administer',
      // 003-controls-management — a Risk Manager already links controls to
      // a risk's treatment (`risk:treat`, `LinkControlUseCase`) and needs
      // to see a control's own record (owner, status, effectiveness) to
      // judge whether it is a credible treatment — read-only, the same
      // shape as `evidence:view`/`action:view`/`finding:view` above; never
      // `control:edit`/`control:test`/`control:approve` — this role does
      // not operate the Controls module itself.
      'control:view',
      // 006-assets-processes, T006 (research.md D-7/A-6) — this role
      // already links a risk's treatment to an asset/process
      // (`LinkAssetUseCase`/`LinkProcessUseCase`) and today reaches the
      // inventory only because it holds `risk:view`, which
      // `GET /assets`/`GET /processes` require until this fase. Once that
      // authority moves to the resource's own permission (US2, FR-009),
      // this role would silently lose the inventory it already uses unless
      // it also receives `asset:view`/`process:view` here — the same
      // "write implies read" class of gap `audit-engagement-write-implies-
      // read.spec.ts` already guards for Audit Lead. Read-only, mirroring
      // `control:view` above: this role does not operate the Assets or
      // Processes modules themselves.
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Risk Analyst',
    // F-32 — rationale moved out of the persisted description, which now
    // says only what the role lets a person DO. The design behind it, in
    // full: this role holds `risk:transition` (REQUEST an approval-gated
    // lifecycle transition) and deliberately EXCLUDES `risk:approve`, which
    // belongs to Risk Approver below. That disjointness is FR-029a's
    // segregation of duties — the same person must never both request and
    // decide the same approval-gated transition. The separation exists
    // precisely so `risk:transition` can be granted BROADLY (as it is here,
    // to every analyst) while `risk:approve` stays granted NARROWLY. The
    // product-facing half of this — requests but never decides — is what the
    // description below has to preserve, in business language.
    description:
      'Captura e avalia riscos no seu escopo organizacional e pode solicitar transições de ciclo ' +
      'de vida sujeitas a aprovação — mas nunca decide a aprovação que solicitou.',
    permissions: [
      'risk:view',
      'risk:create',
      'risk:edit',
      'risk:assess',
      'risk:transition',
      'comment:create',
      'attachment:create',
      // 002-shared-grc-foundation/US1 — may record and link evidence
      // (parallel to comment:create/attachment:create above), but not
      // edit/archive someone else's evidence record nor administer it —
      // mirrors the same view/create-only shape this role already has for
      // risk:treat (absent here) and risk:approve (absent here).
      'evidence:view',
      'evidence:create',
      'evidence:link',
      // 002-shared-grc-foundation/US2 — a Risk Analyst is a realistic
      // "responsável" for remediation work (SC-002's own "Minhas ações"
      // motivating scenario) and must be able to work through the
      // lifecycle of an action assigned to them (action:edit covers both
      // field edits and lifecycle transitions, per action-permissions.ts's
      // own header) — but not action:create, because this role does not
      // hold risk:treat, and creating a RISK_TREATMENT-origin action
      // requires edit authority on the origin risk (FR-031), which this
      // role does not have.
      'action:view',
      'action:edit',
      // 002-shared-grc-foundation/US3 — an analyst records findings from
      // a self-assessment and refines their categorization (parallel to
      // evidence:create/link above), but does not administer (archive) or
      // close them — closing is the segregation-of-duties gate (FR-025)
      // and belongs to the Risk Approver role instead.
      'finding:view',
      'finding:create',
      'finding:edit',
      // 006-assets-processes, T006 (research.md D-7/A-6) — same
      // compensation as Risk Manager above: this role reaches the
      // inventory today only via `risk:view`, and must not lose it once
      // that authority moves to `asset:view`/`process:view` (US2, FR-009).
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Risk Approver',
    // F-32 — rationale moved out of the persisted description. In full: this
    // role deliberately EXCLUDES `risk:create`/`risk:edit`/`risk:assess`/
    // `risk:treat`/`risk:transition` and holds `risk:approve`. It is kept
    // narrow and distinct from Risk Analyst on purpose, so FR-029a's
    // segregation of duties stays administrable: `risk:approve` is granted
    // to a small group of approvers, and holding it carries no authority to
    // author the very record being decided. `finding:close` is here for the
    // same reason (see the permission list's own comment below).
    description:
      'Decide as aprovações do ciclo de vida do risco, como aceitação e encerramento. Papel de ' +
      'decisão: consulta os riscos para decidir, mas não os captura, edita, avalia nem trata.',
    permissions: [
      'risk:view',
      'risk:approve',
      'comment:create',
      // 002-shared-grc-foundation/US1 — an approver must be able to read
      // the proof behind a decision (spec.md US1's own "meses depois, uma
      // auditora precisa ver qual prova sustentava aquela decisão"
      // scenario applies equally at approval time) without gaining any
      // write authority over evidence itself.
      'evidence:view',
      // 002-shared-grc-foundation/US2 — an approver may need to confirm
      // remediation work is genuinely complete before deciding an
      // approval, the same read-only reasoning evidence:view above already
      // documents — without gaining any write authority over actions.
      'action:view',
      // 002-shared-grc-foundation/US3 — `finding:close` is the
      // segregation-of-duties gate (FR-025): whoever closes a finding may
      // not be the responsible user of any completed action linked to it.
      // The Risk Approver role already exists specifically to hold this
      // kind of independent decision authority, distinct from whoever
      // captures/remediates (the same reasoning that gives this role
      // risk:approve while excluding risk:create/edit/treat) — so this is
      // the one role, beyond Platform Administrator, that receives it.
      // Deliberately EXCLUDES finding:create/edit/administer: this role
      // does not do the day-to-day recording or archival work.
      'finding:view',
      'finding:close',
      // 006-assets-processes, T006 (research.md D-7/A-6) — same
      // compensation as Risk Manager/Risk Analyst above: this role reaches
      // the inventory today only via `risk:view`, and would lose the
      // ability to see the asset/process an approval decision concerns
      // once that authority moves to `asset:view`/`process:view` (US2,
      // FR-009).
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Control Owner',
    // F-32 — rationale moved out of the persisted description. In full: this
    // role deliberately EXCLUDES `control:approve`. Whoever runs an
    // effectiveness test, or answers for the control, never decides its own
    // attestation — invariants C1/C2 of 003-controls-management
    // (data-model.md §4, FR-017/FR-018). The domain enforces that separation
    // per USER as well, so it holds even when one person happens to carry
    // both this role and Control Approver; keeping the two roles disjoint is
    // what makes the separation administrable in the first place.
    description:
      'Mantém o catálogo de controles no seu escopo organizacional: cadastra, edita, coloca em ' +
      'operação e executa verificações de efetividade. Não atesta as próprias verificações.',
    permissions: ['control:view', 'control:create', 'control:edit', 'control:test'],
    globalScope: false,
  },
  {
    name: 'Control Approver',
    // F-32 — rationale moved out of the persisted description. In full: kept
    // narrow and distinct from Control Owner, deliberately EXCLUDING
    // `control:create`/`control:edit`/`control:test`, so the attestation
    // segregation of duties (invariants C1/C2, 003-controls-management
    // data-model.md §4) is administrable by granting `control:approve` to a
    // small group of approvers.
    description:
      'Atesta ou recusa as verificações de efetividade pendentes de decisão. Papel de decisão: ' +
      'não cadastra, não edita e não executa verificações de controle.',
    permissions: ['control:view', 'control:approve'],
    globalScope: false,
  },
  {
    name: 'Compliance Manager',
    // F-32 — rationale moved out of the persisted description. In full:
    // 004-compliance-management/research.md D-13 decided there is NO
    // segregation of duties among this role's three compliance permissions —
    // no FR and no acceptance scenario of that phase asks that declaring a
    // requirement not applicable, mapping it to a control, and publishing a
    // framework version be held by distinct roles. That is a deliberate
    // decision, not an omission; if a later phase needs the split, it splits
    // this role rather than discovering the gap in production.
    description:
      'Mantém a biblioteca normativa — frameworks, versões e requisitos —, o mapeamento entre ' +
      'requisito e controle e as declarações de aplicabilidade.',
    permissions: [
      'compliance:view',
      'compliance:administer',
      'compliance:map',
      // ADR-020 part 5 — mapping a requirement to a control (`compliance:map`,
      // `LinkRequirementToControlUseCase`) requires `control:view` on the
      // referenced control since that use case now enforces the ADR-020
      // part 5 pairing; without it, this role could never actually complete
      // the mapping work its own description names, and the control picker
      // it maps from would refuse it the very list it is linking from —
      // exactly the gap `test/unit/control-link-permission-pairing.spec.ts`
      // now guards structurally over the seed.
      'control:view',
    ],
    globalScope: false,
  },
  {
    name: 'Auditor',
    // 008-incidents-problems, defect fix — description corrected to name
    // every domain this role can actually read (it had accumulated
    // evidence/action/finding/audit-engagement/asset/process view access
    // across prior phases without the description ever being updated to
    // say so); now also names incident/problem, added by this fix.
    // 009-indicators-reports — description extended again, this time
    // alongside the permissions that grant it, to name indicator/report
    // view access before the description falls behind a third time (the
    // same lag the 008 defect fix above corrected twice already).
    description:
      'Leitura de toda a organização: riscos, evidências, ações, achados, engajamentos de ' +
      'auditoria, ativos, processos, incidentes, problemas, indicadores, relatórios e a trilha ' +
      'de auditoria.',
    // 002-shared-grc-foundation/US1 — `evidence:view` is what lets an
    // auditor reconstruct which evidence supported a decision, at any
    // later date, across the whole organization (spec.md US1's own
    // motivating scenario) — read-only, same shape as risk:view/audit:view.
    // US2 — `action:view` gives the same reconstruction ability over
    // remediation work (SC-003's own "reconstitui a sequência completa"),
    // read-only, across the whole organization.
    // US3 — `finding:view` gives the same reconstruction ability over
    // findings, across the whole organization: an auditor reconstructing
    // a closed finding's full provenance (SC-003) needs to read the
    // finding itself, not only the evidence/actions it references.
    // 005-audit-findings, T011 (FR-019, research.md D-7) — the SAME papel
    // pre-existing global-scope reader now also gains
    // `audit-engagement:view`, rather than a second read-only role being
    // created for the identical purpose (§19.4, "reutilizar antes de
    // criar").
    // 006-assets-processes, T006 (research.md D-7/A-6) — this role reaches
    // the whole-organization inventory today only via `risk:view`
    // (`GET /assets`/`GET /processes`, which require it until this fase);
    // `asset:view`/`process:view` replace that dependency without narrowing
    // what this globally-scoped role can already see (US2, FR-009).
    // 008-incidents-problems, defect fix — the SAME pre-existing
    // global-scope reader gains `incident:view`/`problem:view`, rather than
    // a second read-only global role being created for the identical
    // purpose (§19.4, "reutilizar antes de criar"): an auditor
    // reconstructing an incident's or a problem's full history, across the
    // whole organization, needs to read the record itself, not only the
    // evidence/actions it references.
    // 009-indicators-reports — the SAME pre-existing global-scope reader
    // gains `indicator:view`/`report:view`, rather than a second read-only
    // global role being created for the identical purpose (§19.4,
    // "reutilizar antes de criar"): `IndicatorMeasurement` is an
    // append-only operational record, and an auditor who cannot read it
    // cannot reconstruct what the organization measured and when — exactly
    // what this role's description above promises. Only the view
    // permissions enter: this role is read-only by design, same
    // distinction the neighboring "Read Only" role's own comment already
    // draws; `indicator:create`/`indicator:edit`/`report:create`/
    // `report:edit` do not belong here.
    permissions: [
      'risk:view',
      'audit:view',
      'evidence:view',
      'action:view',
      'finding:view',
      'audit-engagement:view',
      'asset:view',
      'process:view',
      'incident:view',
      'problem:view',
      'indicator:view',
      'report:view',
    ],
    globalScope: true,
  },
  {
    name: 'Read Only',
    // 008-incidents-problems, defect fix — same correction as Auditor
    // above: this description named only risks while the role had already
    // accumulated evidence/action/finding/asset/process view access; now
    // also names incident/problem, added by this fix.
    // 009-indicators-reports, T009 (spec.md FR-035) — same correction again:
    // now also names indicators/reports, added by this fix.
    description:
      'Somente leitura, dentro do escopo organizacional do usuário: riscos, evidências, ações, ' +
      'achados, ativos, processos, incidentes, problemas, indicadores e relatórios.',
    // 002-shared-grc-foundation/US2 — `action:view` mirrors `evidence:view`
    // above: read-only visibility within scope, no write authority.
    // US3 — `finding:view` mirrors the same read-only shape.
    // 006-assets-processes, T006 (research.md D-7/A-6) — `asset:view`/
    // `process:view` mirror the same read-only shape, replacing the
    // `risk:view`-gated access this role already has to the inventory
    // today (US2, FR-009).
    permissions: [
      'risk:view',
      'evidence:view',
      'action:view',
      'finding:view',
      'asset:view',
      'process:view',
      // 008-incidents-problems, defect fix (Fase 8 shipped with no
      // non-administrator role able to open either module) — same
      // read-only shape as every resource already above: view within the
      // caller's own organizational scope, no write authority.
      'incident:view',
      'problem:view',
      // 009-indicators-reports, T009 (spec.md FR-035, research.md D-13) — a
      // role whose whole purpose is "see everything within scope" would
      // silently fail to satisfy its own description the moment the two
      // new screens exist, the same class of gap already corrected above
      // for Incident/Problem. `indicator:create`/`indicator:edit`/
      // `report:create`/`report:edit` are deliberately NOT granted here:
      // this role is read-only by design.
      'indicator:view',
      'report:view',
    ],
    globalScope: false,
  },
  {
    name: 'Audit Lead',
    description:
      'Conduz engajamentos de auditoria de ponta a ponta — abre, escopa, inicia e encerra —, ' +
      'registra os achados que produz, move-os para remediação e os vincula ao controle ou ao ' +
      'risco que apontam.',
    // 005-audit-findings, T009/T011 (research.md D-7, data-model.md §10) —
    // `finding:create`/`finding:close` são reusados, mesmo identificador
    // do caminho manual (FR-008) — a segregação de funções do fechamento
    // (Invariante F2, já existente desde a Fase 1) continua sendo o que
    // impede o mesmo ator de remediar e fechar, não a ausência da
    // permissão. `finding:remediate`/`finding:link` agora existem no
    // catálogo estático (`grc/finding/domain/finding-permissions.ts`,
    // T009) — a permissão que faltava para este papel completar a
    // trilha de trabalho que sua própria descrição já prometia.
    permissions: [
      // 005-audit-findings, correction found while wiring the Fase 6 UI:
      // this role held every WRITE authority over an engagement and over a
      // finding, and neither READ permission. As seeded it could open an
      // engagement and never read it back — `GET /audits`,
      // `GET /audits/{id}`, `GET /audits/{id}/findings` and even
      // `POST /audits/{id}/findings` (whose first gate is
      // `audit-engagement:view`, folded into a 404) all refused it, and the
      // shell's own "Auditoria" entry, gated by `audit-engagement:view`,
      // never appeared. That directly contradicted this role's own
      // description above ("Conduz engajamentos de auditoria de ponta a
      // ponta"). `finding:view` is here for the same reason on the other
      // resource: a role that creates, remediates, links and closes
      // findings but cannot `GET /findings/{id}` is incoherent.
      // `audit-engagement-write-implies-read.spec.ts` guards both pairings
      // structurally so this cannot silently regress.
      'audit-engagement:view',
      'audit-engagement:create',
      'audit-engagement:edit',
      'audit-engagement:scope',
      'audit-engagement:transition',
      'finding:view',
      'finding:create',
      'finding:close',
      'finding:remediate',
      'finding:link',
      // `finding:link` requires `control:view`/`risk:view` on the
      // referenced side too (ADR-020 part 5) — without these, this role
      // could declare a link's write side but never satisfy the paired
      // read-side check, the exact gap
      // `test/unit/control-link-permission-pairing.spec.ts`-equivalent
      // guards for this module (T068).
      'control:view',
      'risk:view',
      // 006-assets-processes, T006 (research.md D-7/A-6) — this role
      // reaches the inventory today only via `risk:view`, and would lose
      // the ability to see the asset/process a finding it records points
      // to once that authority moves to `asset:view`/`process:view` (US2,
      // FR-009).
      'asset:view',
      'process:view',
    ],
    globalScope: false,
  },
  {
    name: 'Incident Manager',
    // F-32 — rationale moved out of the persisted description. In full:
    // FR-006 (008-incidents-problems/spec.md) decides EXPLICITLY that
    // closing an incident does NOT require segregation of duties between
    // whoever resolved it and whoever closes it — incident response is
    // time-critical and the same responder legitimately does both. That is
    // why a single role covers the whole lifecycle here, unlike Risk
    // Analyst/Risk Approver and Control Owner/Control Approver above. Same
    // reasoning as Compliance Manager. Note the contrast with Problem
    // Manager below, where closure DOES carry a per-user separation.
    description:
      'Opera o registro de incidentes de ponta a ponta no seu escopo organizacional: registra, ' +
      'edita, transiciona, vincula a risco, ativo ou processo e conduz a ação corretiva e sua ' +
      'evidência.',
    permissions: [
      'incident:view',
      'incident:create',
      'incident:edit',
      'incident:transition',
      'incident:link',
      // ADR-020 part 5 — creating any of the three link pairs this role's
      // own `incident:link` writes (Risk/Asset/Process, spec.md FR-013) is
      // checked against the TARGET's own read authority inside the use
      // case itself (`LinkIncidentRiskUseCase`/`...Asset`/`...Process`),
      // not only the decorator on the route. Without these three, this
      // role could call the endpoint and still have every link attempt
      // refused as "not found" — the same class of gap
      // `control-link-permission-pairing.spec.ts`/
      // `finding-link-permission-pairing.spec.ts` guard structurally for
      // Controls/Findings.
      'risk:view',
      'asset:view',
      'process:view',
      // 008-incidents-problems, US4 — an Incident Manager is the
      // "responsável" who records the corrective/mitigating work
      // (`ActionOriginType.INCIDENT`, gated by `incident:edit` on
      // `createAction`'s own origin check,
      // `IncidentActionOriginAccessor.resolveEditableOrigin`) and moves it
      // through its lifecycle — the same view/create/edit shape Risk
      // Manager already holds for its own `RISK_TREATMENT`-origin actions.
      'action:view',
      'action:create',
      'action:edit',
      // US4 — records the proof of what happened or was done
      // (`EvidenceSubjectType.INCIDENT`, gated by `incident:view` on
      // `IncidentEvidenceSubjectAccessor.resolveViewableSubject`) — the
      // same view/create/link shape Risk Analyst already holds, without
      // `evidence:administer`: this role does not archive evidence it did
      // not create.
      'evidence:view',
      'evidence:create',
      'evidence:link',
      // US4 scenario 4 — comments and raw attachments on an incident use
      // the same generic, already-existing capability every other
      // operational role above already holds to use its own detail page.
      'comment:create',
      'attachment:create',
    ],
    globalScope: false,
  },
  {
    name: 'Problem Manager',
    // F-32 — rationale moved out of the persisted description. In full:
    // closing a problem DOES carry a segregation of duties (FR-011 /
    // invariant P3, 008-incidents-problems/data-model.md): whoever closes it
    // must not be the person who completed the definitive corrective action
    // that satisfies FR-010. Unlike Risk Analyst/Risk Approver, that
    // separation is enforced by the DOMAIN, per USER, not by splitting the
    // permission across two roles — so any holder of this role may close a
    // problem, as long as they were not the one who completed the action.
    // That is why this role legitimately holds the full lifecycle, and why
    // the description below does not promise a second approver role that
    // does not exist.
    description:
      'Opera o registro de problemas de ponta a ponta no seu escopo organizacional: registra, ' +
      'edita, transiciona, documenta a causa raiz, vincula a risco ou incidente e conduz a ação ' +
      'corretiva definitiva.',
    permissions: [
      'problem:view',
      'problem:create',
      'problem:edit',
      'problem:transition',
      'problem:link',
      // ADR-020 part 5 — same reasoning as Incident Manager's risk/asset/
      // process grants above, for the two pairs `problem:link` writes:
      // `ProblemRiskLink` (spec.md FR-013) needs `risk:view` on the
      // target, and the write side of `ProblemIncidentLink` (FR-015a/
      // FR-015b, owned by this module by decision of the coordinator,
      // research.md D-14) needs `incident:view` on the target incident —
      // without it, this role could call
      // `POST /problems/{problemId}/incidents` and have it refused as
      // "not found" every time.
      'risk:view',
      'incident:view',
      // 008-incidents-problems, US2/US4 — the correction that closes a
      // problem (FR-010) is a real `Action` with `originType: PROBLEM`,
      // never a text field that claims one exists; this role is who
      // creates and works it (gated by `problem:edit` on
      // `ProblemActionOriginAccessor.resolveEditableOrigin`), same shape
      // as Incident Manager above.
      'action:view',
      'action:create',
      'action:edit',
      // US4 — the proof of the root-cause analysis
      // (`EvidenceSubjectType.PROBLEM`, gated by `problem:view` on
      // `ProblemEvidenceSubjectAccessor.resolveViewableSubject`), same
      // view/create/link shape as Incident Manager above.
      'evidence:view',
      'evidence:create',
      'evidence:link',
      // US4 scenario 4 — same generic comment/attachment capability as
      // Incident Manager above.
      'comment:create',
      'attachment:create',
    ],
    globalScope: false,
  },
];

const ROOT_ORG_UNIT_CODE = 'ROOT';
const ROOT_ORG_UNIT_NAME = 'PharosGRC';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface PlatformSeedResult {
  readonly permissionCount: number;
  readonly roleCount: number;
  readonly rootOrgUnitId: string;
  readonly adminUserId: string;
  readonly devFixturesSeeded: boolean;
}

/**
 * `prisma` is the raw `PrismaClient` the seed's Nest application context
 * hands over (`prisma/seed/index.ts`) — the seed runs its own single
 * transaction directly against it rather than through `PrismaService`'s
 * `AsyncLocalStorage`-based `runInTransaction` (that mechanism exists to
 * let `AuditRecorder` join an ambient transaction implicitly; a seed
 * script writes no audit rows at all — see the file header — so there is
 * nothing that needs to share this transaction implicitly, and a plain
 * `prisma.$transaction(...)` is the simpler, equally correct tool here).
 */
export async function seedPlatform(
  prisma: PrismaClient,
  appConfig: AppConfigService,
): Promise<PlatformSeedResult> {
  const runDevFixtures = assertDevFixturesAllowed(appConfig);

  // Password hashing (argon2id, deliberately slow) happens BEFORE opening
  // the transaction — an interactive transaction should hold no more than
  // the DML it needs; hashing has no business inside it and would only
  // extend how long any lock/idle-in-transaction window stays open.
  const adminPasswordHash = await hashPassword(requireAdminPassword(appConfig), appConfig.argon2);
  const devFixturePasswordHash = runDevFixtures
    ? await hashPassword(requireAdminPassword(appConfig), appConfig.argon2)
    : undefined;

  return prisma.$transaction(async (tx) => {
    const permissionsByIdentifier = await upsertPermissions(tx);
    const rolesByName = await upsertSystemRoles(tx, permissionsByIdentifier);
    const rootUnit = await upsertRootOrgUnit(tx);

    const admin = await upsertBootstrapAdmin(tx, {
      email: appConfig.seed.adminEmail,
      passwordHash: adminPasswordHash,
      role: rolesByName.get('Platform Administrator')!,
      primaryOrgUnitId: rootUnit.id,
    });

    let devFixturesSeeded = false;
    if (runDevFixtures && devFixturePasswordHash) {
      await seedDevFixtures(tx, {
        rolesByName,
        rootUnit,
        passwordHash: devFixturePasswordHash,
        provisionedByUserId: admin.id,
      });
      devFixturesSeeded = true;
    }

    return {
      permissionCount: permissionsByIdentifier.size,
      roleCount: rolesByName.size,
      rootOrgUnitId: rootUnit.id,
      adminUserId: admin.id,
      devFixturesSeeded,
    };
  });
}

// ---------------------------------------------------------------------------
// The dev-fixture guard — robust, not a bare `if`
// ---------------------------------------------------------------------------

/**
 * Returns whether development fixtures should be seeded. This is
 * deliberately NOT just `return appConfig.seed.devFixtures;`:
 *
 *   - `SEED_DEV_FIXTURES=true` together with `NODE_ENV=production` is not
 *     silently downgraded to "skip fixtures" (which would hide a real
 *     misconfiguration from whoever set the flag) and not silently allowed
 *     through either — it is a hard, loud failure that stops the ENTIRE
 *     seed run (including the always-seeded permissions/roles/root unit),
 *     because a `.env` that gets this wrong cannot be trusted to be a
 *     genuine production configuration at all.
 *   - The check reads `AppConfigService.app.isProduction`, which is
 *     itself derived from `NODE_ENV` validated by `env.schema.ts` at
 *     process boot (`validateEnv`) — not a second, independently-typed
 *     re-parse of `process.env` in this file (this file never touches
 *     `process.env` at all, per the "no process.env outside the config
 *     layer" rule).
 */
function assertDevFixturesAllowed(appConfig: AppConfigService): boolean {
  const { devFixtures } = appConfig.seed;
  const { isProduction } = appConfig.app;

  if (devFixtures && isProduction) {
    throw new Error(
      'SEED_DEV_FIXTURES=true while NODE_ENV=production. Refusing to run the seed at all: ' +
        'development fixture users (with a known, shared, configuration-sourced password) must ' +
        'never be created in a production database. Set SEED_DEV_FIXTURES=false (or remove it) ' +
        'before seeding a production environment.',
    );
  }

  return devFixtures && !isProduction;
}

function requireAdminPassword(appConfig: AppConfigService): string {
  const { adminPassword } = appConfig.seed;
  if (!adminPassword) {
    // env.schema.ts deliberately does not `.min(1)` SEED_ADMIN_PASSWORD —
    // its own comment states this failure belongs here, not in
    // environment validation, since the API process must be able to boot
    // (and run) without ever running the seed.
    throw new Error(
      'SEED_ADMIN_PASSWORD is not set. Refusing to seed a bootstrap administrator account with an ' +
        'empty/no password — set SEED_ADMIN_PASSWORD in apps/api/.env before running the seed.',
    );
  }
  return adminPassword;
}

async function hashPassword(password: string, argon2Settings: Argon2Settings): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: argon2Settings.memoryCost,
    timeCost: argon2Settings.timeCost,
    parallelism: argon2Settings.parallelism,
  });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

async function upsertPermissions(
  tx: Prisma.TransactionClient,
): Promise<ReadonlyMap<PermissionIdentifier, { id: string }>> {
  const definitions = getAllPermissionDefinitions();
  const byIdentifier = new Map<PermissionIdentifier, { id: string }>();

  for (const definition of definitions) {
    const row = await tx.permission.upsert({
      where: { identifier: definition.identifier },
      create: {
        identifier: definition.identifier,
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
      update: {
        resource: definition.resource,
        action: definition.action,
        description: definition.description,
      },
      select: { id: true },
    });
    byIdentifier.set(definition.identifier as PermissionIdentifier, row);
  }

  return byIdentifier;
}

// ---------------------------------------------------------------------------
// System roles
// ---------------------------------------------------------------------------

async function upsertSystemRoles(
  tx: Prisma.TransactionClient,
  permissionsByIdentifier: ReadonlyMap<PermissionIdentifier, { id: string }>,
): Promise<ReadonlyMap<string, { id: string }>> {
  const rolesByName = new Map<string, { id: string }>();

  for (const definition of SYSTEM_ROLE_DEFINITIONS) {
    const role = await tx.role.upsert({
      where: { name: definition.name },
      create: {
        name: definition.name,
        description: definition.description,
        isSystem: true,
      },
      // `description` is reconciled on every run, NOT create-only — the
      // deliberate opposite of `upsertBootstrapAdmin`'s `update: {}` (F-60
      // leaves the bootstrap administrator's own placement untouched on
      // purpose — see that function's own comment). `seedDevFixtures`'s
      // user upsert used to share that same `update: {}` shape too, until
      // F-60's fix reconciled `primaryOrgUnitId` there specifically — see
      // that call site's own comment for why only that one field, and only
      // for fixture-owned rows. This role reconciliation pre-dates the F-32
      // rewrite of these descriptions and is what let that rewrite reach an
      // ALREADY-SEEDED database instead of only a freshly created one,
      // exactly as the file header's "converges to the current definition
      // on every run" rule and `reconcileRolePermissions` already promise
      // for the permission set.
      //
      // Known asymmetry, recorded rather than silently relied upon (F-68):
      // `RoleAdminService.update` refuses `name` and `permissionIdentifiers`
      // on an `isSystem` role but ACCEPTS `description`. So an operator can
      // edit a seeded role's description through the product (audited as
      // `role.updated`), and the next seed run overwrites that edit with the
      // literal above — writing no `audit_event` of its own, because a seed
      // run has no acting identity and inventing one would pollute the
      // evidentiary trail (see this file's header, ADR-005). Which of the
      // two should win is a product decision, not one to take inside a
      // text-content fix; until it is taken, THIS file is the source of
      // truth for a system role's description.
      update: {
        description: definition.description,
        isSystem: true,
      },
      select: { id: true },
    });
    rolesByName.set(definition.name, role);

    await reconcileRolePermissions(tx, role.id, definition.permissions, permissionsByIdentifier);
  }

  return rolesByName;
}

/**
 * Makes `roleId`'s `RolePermission` rows exactly match `permissions` —
 * inserts what is missing, removes what should no longer be assigned.
 * This is what lets the seed converge a role's permission set to its
 * current definition on every run, not merely avoid duplicating rows on a
 * literal re-run of an unchanged definition.
 *
 * ## Assurance fix (Fix 7, confirmed gap) — cache invalidation
 *
 * This function adds AND removes `RolePermission` rows directly through
 * Prisma, but — unlike every application-level write path that changes a
 * role's permission set (`RoleAdminService.update`/`replaceUserRoles`,
 * `core/authorization/application/role-admin.service.ts`) — it used to
 * never call `bumpPermissionsVersion()`. Since the seed is the documented
 * bootstrap AND redeploy path (run again whenever `SYSTEM_ROLE_DEFINITIONS`
 * changes), a user with a warm `PermissionResolverService` cache entry kept
 * a permission this exact run just REMOVED for up to that cache's TTL —
 * contradicting the platform's stated "effective on the next request"
 * authorization guarantee. Fixed the SAME way `RoleAdminService` already
 * does it: bump the version, once per role, but ONLY when this call
 * actually changed that role's permission set (`toAdd`/`toRemove`
 * non-empty) — a no-op reconciliation (the common case: re-running the
 * seed against an already-converged database) must not bump the version
 * on every single deploy for no real change.
 */
async function reconcileRolePermissions(
  tx: Prisma.TransactionClient,
  roleId: string,
  permissions: readonly PermissionIdentifier[],
  permissionsByIdentifier: ReadonlyMap<PermissionIdentifier, { id: string }>,
): Promise<void> {
  const desiredPermissionIds = new Set(
    permissions.map((identifier) => {
      const permission = permissionsByIdentifier.get(identifier);
      if (!permission) {
        throw new Error(
          `Role definition references permission identifier "${identifier}", which is not in ` +
            'getAllPermissionDefinitions(). Every role permission must be a real, registered ' +
            'permission identifier.',
        );
      }
      return permission.id;
    }),
  );

  const existing = await tx.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });
  const existingPermissionIds = new Set(existing.map((row) => row.permissionId));

  const toAdd = Array.from(desiredPermissionIds).filter((id) => !existingPermissionIds.has(id));
  const toRemove = Array.from(existingPermissionIds).filter((id) => !desiredPermissionIds.has(id));

  if (toAdd.length > 0) {
    await tx.rolePermission.createMany({
      data: toAdd.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await tx.rolePermission.deleteMany({
      where: { roleId, permissionId: { in: toRemove } },
    });
  }

  // Assurance fix (Fix 7) — see this function's own header. Same
  // `permission_cache_state.permissions_version` counter
  // `PrismaPermissionRepository.bumpPermissionsVersion` increments; the
  // seed writes it directly (a plain Postgres UPDATE) rather than going
  // through that class, since a standalone seed script has no NestJS DI
  // container to resolve it from.
  if (toAdd.length > 0 || toRemove.length > 0) {
    await tx.permissionCacheState.update({
      where: { id: 'singleton' },
      data: { permissionsVersion: { increment: 1 } },
    });
  }
}

// ---------------------------------------------------------------------------
// Root organizational unit
// ---------------------------------------------------------------------------

interface SeededOrgUnit extends OrgUnitPathInfo {
  readonly code: string;
}

async function upsertRootOrgUnit(tx: Prisma.TransactionClient): Promise<SeededOrgUnit> {
  const existing = await tx.organizationalUnit.findUnique({
    where: { code: ROOT_ORG_UNIT_CODE },
    select: { id: true, path: true, depth: true },
  });

  if (existing) {
    return {
      id: existing.id,
      path: existing.path,
      depth: existing.depth,
      code: ROOT_ORG_UNIT_CODE,
    };
  }

  // The materialized path embeds the unit's own id (`computeRootPath`,
  // ADR-004), so the id must be known BEFORE the row is created — generated
  // here rather than left to Prisma's `@default(uuid(7))`.
  const id = randomUUID();
  const rootPath = computeRootPath(id);

  await tx.organizationalUnit.create({
    data: {
      id,
      code: ROOT_ORG_UNIT_CODE,
      name: ROOT_ORG_UNIT_NAME,
      parentId: null,
      path: rootPath.path,
      depth: rootPath.depth,
      status: OrgUnitStatus.ACTIVE,
    },
  });

  return { ...rootPath, code: ROOT_ORG_UNIT_CODE };
}

// ---------------------------------------------------------------------------
// Bootstrap administrator
// ---------------------------------------------------------------------------

interface UpsertBootstrapAdminInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly role: { id: string };
  readonly primaryOrgUnitId: string;
}

async function upsertBootstrapAdmin(
  tx: Prisma.TransactionClient,
  input: UpsertBootstrapAdminInput,
): Promise<{ id: string }> {
  const user = await tx.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      fullName: 'Platform Administrator',
      status: UserStatus.ACTIVE,
      primaryOrgUnitId: input.primaryOrgUnitId,
    },
    // Non-sensitive attributes only — never touches anything
    // security-relevant, and never moves an already-provisioned admin's
    // organizational unit out from under them on a re-run.
    update: {},
    select: { id: true },
  });

  await ensureLocalCredential(tx, user.id, input.passwordHash);
  await ensureRoleAssignment(tx, {
    userId: user.id,
    roleId: input.role.id,
    grantedByUserId: user.id,
  });
  await ensureGlobalScopeGrant(tx, { userId: user.id, grantedByUserId: user.id });

  return user;
}

/**
 * Creates the `LocalCredential` ONLY if none exists yet. See the file
 * header's "Idempotency" section: a re-run must never reset an
 * already-changed password back to the seed default.
 */
async function ensureLocalCredential(
  tx: Prisma.TransactionClient,
  userId: string,
  passwordHash: string,
): Promise<void> {
  const existing = await tx.localCredential.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    return;
  }

  await tx.localCredential.create({
    data: {
      userId,
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

async function ensureRoleAssignment(
  tx: Prisma.TransactionClient,
  input: { userId: string; roleId: string; grantedByUserId: string },
): Promise<void> {
  await tx.userRole.upsert({
    where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
    create: {
      userId: input.userId,
      roleId: input.roleId,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
    // A role grant's `grantedAt`/`grantedByUserId` are the historical facts
    // of WHEN and BY WHOM it was first granted (data-model.md §3) — a
    // re-run must not rewrite that history for an assignment that already
    // exists, so `update` is a no-op.
    update: {},
  });
}

async function ensureGlobalScopeGrant(
  tx: Prisma.TransactionClient,
  input: { userId: string; grantedByUserId: string },
): Promise<void> {
  const existing = await tx.orgScopeGrant.findFirst({
    where: { userId: input.userId, scopeType: OrgScopeType.GLOBAL },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await tx.orgScopeGrant.create({
    data: {
      userId: input.userId,
      scopeType: OrgScopeType.GLOBAL,
      orgUnitId: null,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
  });
}

async function ensureUnitScopeGrant(
  tx: Prisma.TransactionClient,
  input: { userId: string; orgUnitId: string; grantedByUserId: string },
): Promise<void> {
  const existing = await tx.orgScopeGrant.findFirst({
    where: { userId: input.userId, scopeType: OrgScopeType.UNIT, orgUnitId: input.orgUnitId },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  await tx.orgScopeGrant.create({
    data: {
      userId: input.userId,
      scopeType: OrgScopeType.UNIT,
      orgUnitId: input.orgUnitId,
      grantedByUserId: input.grantedByUserId,
      grantedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Development-only fixtures (SEED_DEV_FIXTURES)
// ---------------------------------------------------------------------------

interface SeedDevFixturesInput {
  readonly rolesByName: ReadonlyMap<string, { id: string }>;
  readonly rootUnit: SeededOrgUnit;
  readonly passwordHash: string;
  readonly provisionedByUserId: string;
}

/**
 * One user per system role (T042's task text) plus a two-level
 * organizational unit tree hanging off the root: two divisions directly
 * under root (depth 1), and two teams under the first division (depth 2)
 * — "two-level" meaning two levels of fixture structure beneath the
 * always-seeded root, giving `ScopeResolverService`'s descendant expansion
 * (FR-025b) a non-trivial tree to be validated against in later stories.
 */
async function seedDevFixtures(
  tx: Prisma.TransactionClient,
  input: SeedDevFixturesInput,
): Promise<void> {
  const divisionA = await upsertChildOrgUnit(tx, input.rootUnit, 'DIV-A', 'Division A (fixture)');
  const divisionB = await upsertChildOrgUnit(tx, input.rootUnit, 'DIV-B', 'Division B (fixture)');
  const teamA1 = await upsertChildOrgUnit(
    tx,
    divisionA,
    'DIV-A-TEAM-1',
    'Division A / Team 1 (fixture)',
  );
  const teamA2 = await upsertChildOrgUnit(
    tx,
    divisionA,
    'DIV-A-TEAM-2',
    'Division A / Team 2 (fixture)',
  );

  // US5 (T136 E2E) — one fixture Control/Process/Asset row so the risk
  // Controls section's "link" picker has something real to find. Neither
  // Control, Process nor Asset has a create endpoint yet (each is a
  // minimal registry, not its own business module — see `schema.prisma`'s
  // own comment on `Process`/`Asset`), so there is no UI path that could
  // ever create one; without a seeded row, `T136`'s "link a control" step
  // would have nothing to select. Dev-fixtures-gated like every other
  // fixture in this function — never seeded in production
  // (`assertDevFixturesAllowed`).
  await tx.control.upsert({
    where: { code: 'FIXTURE-CONTROL-1' },
    create: {
      code: 'FIXTURE-CONTROL-1',
      name: 'Controle de acesso lógico (fixture)',
      isActive: true,
    },
    update: {},
  });
  // 006-assets-processes, T007 (research.md D-2/§"Consequência aceita",
  // data-model.md §6): both fixture rows are given `orgUnitId` HERE, in the
  // SAME task that seeds `asset:view`/`process:view` (T006) — not later.
  // They were created with a NULL organizational unit (before either module
  // had a concept of scope), and `NULL IN (...)` never matches a
  // scope-by-unit predicate (`applyScopeToWhere`) — once a listing applies
  // organizational scope (Fase 5, T033), a NULL-unit row is invisible to
  // every unit-scoped actor, visible only to a GLOBAL-scoped one. Assigning
  // the fixture root's own child unit, `divisionA` (defined above), rather
  // than the root unit itself, matches the round-robin distribution already
  // used for fixture USERS below and keeps this row reachable by a
  // realistically unit-scoped test actor, not only a global one. Assigning
  // the ROOT unit instead was considered and rejected: research.md D-2's own
  // "aumentaria a visibilidade" reasoning against backfilling to root
  // applies with equal force here — root is an ANCESTOR of every fixture
  // unit below it, and organizational scope expands to a granted unit's
  // DESCENDANTS only (`prisma-org-scope.repository.ts`'s own
  // `path: { startsWith }`), never to its ancestors, so a row on root would
  // in fact be reachable by FEWER of the fixture round-robin actors than one
  // on `divisionA` (which teamA1/teamA2 fixture actors — divisionA's own
  // descendants — is not one of; a row scoped to `divisionA` is not visible
  // to a `teamA1`-scoped actor either, since scope descends, never
  // ascends). No FR of this fase requires a SPECIFIC unit, so the choice is
  // this seed's own, not a source of ambiguity for the write-implies-read
  // guard (T008) or the current, still scope-blind listing (T029-T033,
  // unaffected by this change): `update` also carries `orgUnitId` — not
  // left `{}` — so re-running this seed against a database whose fixture
  // rows still carry NULL (as this repository's own dev database did before
  // this fase) converges them too, per this file's own "converges to the
  // current definition on every run" idempotency rule.
  await tx.process.upsert({
    where: { code: 'FIXTURE-PROCESS-1' },
    create: {
      code: 'FIXTURE-PROCESS-1',
      name: 'Processo de aprovação de pagamentos (fixture)',
      isActive: true,
      orgUnitId: divisionA.id,
    },
    update: { orgUnitId: divisionA.id },
  });
  await tx.asset.upsert({
    where: { code: 'FIXTURE-ASSET-1' },
    create: {
      code: 'FIXTURE-ASSET-1',
      name: 'Servidor de banco de dados (fixture)',
      isActive: true,
      orgUnitId: divisionA.id,
    },
    update: { orgUnitId: divisionA.id },
  });

  // Distribute the six fixture users across the fixture tree so later
  // stories can exercise scope resolution across more than one unit.
  const fixtureUnitsRoundRobin = [divisionA, divisionB, teamA1, teamA2];

  // F-15 fix (docs/deferred-findings.md, T179/US8): the generic round-robin
  // above put `Risk Analyst` and `Risk Approver` on sibling units
  // (teamA1/teamA2), which made FR-029a's segregation-of-duties scenario
  // impossible to enact with the seeded fixture users — an Approver whose
  // organizational scope does not cover the Analyst's unit can never even
  // SEE the Analyst's risk to decide on it (FR-025), regardless of holding
  // `risk:approve`. Segregation of duties is a PERMISSION-level separation
  // (the two roles' disjoint permission sets, already correct above), not
  // an organizational one — the two fixture users must share a unit so the
  // scenario is administrable. Every other role keeps the round-robin so
  // scope resolution across more than one unit is still exercised.
  const SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES = new Set(['Risk Analyst', 'Risk Approver']);

  for (const [index, definition] of SYSTEM_ROLE_DEFINITIONS.entries()) {
    const role = input.rolesByName.get(definition.name);
    if (!role) {
      throw new Error(`Role "${definition.name}" was not seeded — cannot create its fixture user.`);
    }

    const orgUnit = SHARED_ANALYST_APPROVER_UNIT_ROLE_NAMES.has(definition.name)
      ? teamA1
      : fixtureUnitsRoundRobin[index % fixtureUnitsRoundRobin.length]!;
    const email = `fixture-${slugify(definition.name)}@pharosgrc.local`;

    // F-60 fix (docs/deferred-findings.md): `primaryOrgUnitId` is now
    // reconciled to the placement this function itself computes above
    // (`orgUnit`), but ONLY for this seed's OWN fixture rows — never for an
    // arbitrary user. `email` here is always this function's own generated
    // `fixture-<slug>@pharosgrc.local` string, which no other code path in
    // the product ever assigns to a real account, so this `where` can never
    // match anything this seed does not itself own. `fullName`/`status`
    // stay create-only, matching every other non-positional field in this
    // file's own idempotency convention (only the field F-60 measured as
    // actually drifting is reconciled — not a blanket "resync everything").
    // Logged only when a run actually changes something, so a long-lived
    // development database's drift from a seed-code fix (like F-15's own
    // reassignment of Risk Analyst/Risk Approver) is visible on the next
    // run instead of silently never reaching an already-seeded database.
    const existingFixtureUser = await tx.user.findUnique({
      where: { email },
      select: { primaryOrgUnitId: true },
    });
    if (existingFixtureUser && existingFixtureUser.primaryOrgUnitId !== orgUnit.id) {
      console.log(
        `[platform.seed] Reconciling primaryOrgUnitId for ${email}: ` +
          `${existingFixtureUser.primaryOrgUnitId ?? 'null'} -> ${orgUnit.id}.`,
      );
    }

    const user = await tx.user.upsert({
      where: { email },
      create: {
        email,
        fullName: `Fixture — ${definition.name}`,
        status: UserStatus.ACTIVE,
        primaryOrgUnitId: orgUnit.id,
      },
      update: { primaryOrgUnitId: orgUnit.id },
      select: { id: true },
    });

    await ensureLocalCredential(tx, user.id, input.passwordHash);
    await ensureRoleAssignment(tx, {
      userId: user.id,
      roleId: role.id,
      grantedByUserId: input.provisionedByUserId,
    });

    if (definition.globalScope) {
      await ensureGlobalScopeGrant(tx, {
        userId: user.id,
        grantedByUserId: input.provisionedByUserId,
      });
    } else {
      await ensureUnitScopeGrant(tx, {
        userId: user.id,
        orgUnitId: orgUnit.id,
        grantedByUserId: input.provisionedByUserId,
      });
    }
  }
}

/**
 * F-16 (docs/deferred-findings.md) fixed the concurrent-worker password
 * race by seeding a static twelve-account pool here, called from
 * `seedDevFixtures` and therefore already correctly gated behind
 * `SEED_DEV_FIXTURES=true` and `NODE_ENV !== 'production'`
 * (`assertDevFixturesAllowed` — combining the flag with a production
 * environment refuses the entire seed run, not merely this pool). D-17/
 * research.md step 3 RETIRES the pool anyway, for the reason the
 * engineering rules already give (AGENTS.md): a shared mutable account
 * pool is what produced F-16's own race and F-34's orphaned users.
 * `apps/web/e2e/support/admin-session.ts`'s `signInAsWorkerAdmin` now
 * provisions each worker's Platform-Administrator-equivalent identity on
 * demand, through the real `POST /admin/users` API, using the bootstrap
 * administrator (`SEED_ADMIN_EMAIL`) as the one seed of trust — never a row
 * this seed script pre-creates.
 */
async function upsertChildOrgUnit(
  tx: Prisma.TransactionClient,
  parent: SeededOrgUnit,
  code: string,
  name: string,
): Promise<SeededOrgUnit> {
  const existing = await tx.organizationalUnit.findUnique({
    where: { code },
    select: { id: true, path: true, depth: true },
  });
  if (existing) {
    return { id: existing.id, path: existing.path, depth: existing.depth, code };
  }

  const id = randomUUID();
  const childPath = computeChildPath(parent, id);

  await tx.organizationalUnit.create({
    data: {
      id,
      code,
      name,
      parentId: parent.id,
      path: childPath.path,
      depth: childPath.depth,
      status: OrgUnitStatus.ACTIVE,
    },
  });

  return { ...childPath, code };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
