/**
 * T093/F-31 — the mirror image of `information-disclosure.spec.ts`'s own
 * exhaustiveness check. That file proves its sweep covers every operation
 * `apps/api/openapi.json` (the reflected document — D-14) declares, i.e.
 * every route the application actually REGISTERED. That direction cannot
 * see a route that was promised but never built: an endpoint with no
 * implementation has no route to be missing from a sweep written against
 * the implementation.
 *
 * `docs/deferred-findings.md` F-31 records exactly this failure mode:
 * `PUT /risks/{riskId}/causes` and `PUT /risks/{riskId}/consequences` were
 * defined in `contracts/risks.openapi.yaml` and called by the frontend, but
 * neither existed in the API — a whole feature dead on arrival, found by
 * the product owner, not by any gate, because every existing check pointed
 * outward from the code rather than inward from the contract.
 *
 * This test closes that gap: it enumerates every `{method, path}` operation
 * declared across the hand-authored contracts — the four from
 * `specs/001-grc-platform-foundation/contracts/*.openapi.yaml`, plus
 * `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
 * (the shared GRC kernel: Evidence, Action, Finding), plus
 * `specs/003-controls-management/contracts/controls.openapi.yaml` (Control
 * catalog/lifecycle, assessments/attestation and process/asset/risk
 * relationships), plus `specs/004-compliance-management/contracts/
 * compliance.openapi.yaml` (normative library, mapping/migration,
 * applicability/compliance state), plus
 * `specs/005-audit-findings/contracts/audit.openapi.yaml` (audit
 * engagement CRUD/lifecycle and scope, the engagement's own producer of
 * findings, `Finding`'s remediation-start edge, and the `Finding<->Control`/
 * `Finding<->Risk` relationships) — the project's authoritative source for
 * what the API promises (D-5, D-14) — and asserts each one is present in
 * `apps/api/openapi.json`, the committed, route-level reflection of what
 * NestJS actually registered (kept fresh by the separate `openapi:check`
 * gate). A contracted operation missing from the registered set fails
 * HERE, by name (`METHOD /path`), not as a count mismatch — exactly the
 * defect class F-31 slipped through. This is also the D-11 gate for Phase
 * 6 (T077) of the shared GRC foundation: it is the same check, extended to
 * an eighth contract, not a second mechanism.
 *
 * ## F-31 recurred here — closed by adding this contract, not by design
 *
 * `specs/005-audit-findings/contracts/audit.openapi.yaml` shipped in
 * commit `f9e5e5b` WITHOUT being added to `CONTRACT_SOURCES` below —
 * `listAuditEngagementFindings`/`createFindingFromEngagement`
 * (`GET`/`POST /audits/{auditId}/findings`) were consequently missing from
 * `apps/api/openapi.json` for a full phase while this gate stayed green,
 * the exact F-31 failure mode this file exists to catch, on the very
 * contract meant to be covered by it. Both operations are implemented now
 * (`AuditEngagementFindingController`) and this entry closes the gate hole
 * that let the gap ship unnoticed.
 *
 * ## Why a hand-rolled line scanner, not a YAML parsing library
 *
 * No YAML parser is a dependency of `apps/api` (only `packages/api-types`
 * depends on `openapi-typescript` for its own, unrelated generation step —
 * adding it here as a second consumer for a single test would be exactly
 * the unjustified dependency CLAUDE.md §2 forbids). All ten contracts
 * share one hand-authored structure this file relies on structurally,
 * verified directly against each before relying on it: a top-level
 * `paths:` key, each path a 2-space-indented `  /some/path:` line, each
 * operation immediately under it a 4-space-indented
 * `    get|post|put|patch|delete:` line, and exactly one `servers:` entry
 * (`  - url: /api/v1`) per document. This is not a general OpenAPI/YAML
 * parser — it would not survive the documents being reformatted — but it
 * is precise about the one thing this test needs, and it is itself
 * verified below: extracting from all ten contracts yields exactly 168
 * operations — the 78 counted at F-31 plus the 20 the shared GRC kernel
 * contract declares (5 Evidence + 3 Evidence Links + 5 Actions +
 * 7 Findings), minus 3 (`GET /controls` moved OUT of
 * `platform.openapi.yaml` in Phase 2, 003-controls-management Task A —
 * ownership of the control catalog transferred to
 * `contracts/controls.openapi.yaml`'s `listControlCatalog` operation —
 * and `GET /processes`/`GET /assets` moved OUT in the same way in
 * 006-assets-processes, Fase 4, T030), plus 18 (`controls.openapi.yaml`'s
 * own full operation count: 6 catalog/lifecycle + 5 assessment/attestation
 * + 7 relationship), plus 23 (`compliance.openapi.yaml`'s own full
 * operation count: 11 normative-library + 6 mapping/migration + 6
 * applicability/compliance-state), plus 20 (`audit.openapi.yaml`'s own
 * full operation count: 11 engagement CRUD/lifecycle/scope + 3
 * findings-from-engagement/remediation-start + 6
 * `Finding<->Control`/`Finding<->Risk` relationship operations), plus 12
 * (`assets.openapi.yaml`/`processes.openapi.yaml`, six operations each —
 * see this file's own header, "006-assets-processes — the fifth and sixth
 * business modules, +12") —
 * `78 + 20 - 3 + 18 + 23 + 20 + 12 = 168`.
 *
 * ## 006-assets-processes — the fifth and sixth business modules, +12
 *
 * `specs/006-assets-processes/contracts/assets.openapi.yaml` and
 * `processes.openapi.yaml`, added in the SAME change as `AssetController`/
 * `ProcessController` (T022/T023 — this task's own explicit instruction:
 * never "add the contract later", the omission that let
 * `listAuditEngagementFindings`/`createFindingFromEngagement` ship
 * unregistered for a whole phase, see "F-31 recurred here" above). Six
 * operations each (`listAssetCatalog`/`createAsset`/`getAsset`/
 * `updateAsset`/`deactivateAsset`/`reactivateAsset`, and the `Process`
 * mirror of all six, FR-020) — `158 + 12 = 170` at the time these two
 * contracts were added (User Story 1). At that point neither contract
 * removed a path from `platform.openapi.yaml`: `GET /assets`/
 * `GET /processes` stayed declared there too, deliberately, until Fase 4
 * (T029-T030) retired them (D-5) — for that one interim fase, two paths
 * were declared in TWO contracts at once, which is why this test's own
 * operation KEYS (`METHOD /path`) could collide harmlessly between
 * `platform.openapi.yaml` and these two new documents: both resolved to
 * the same already-registered route, so neither contract's coverage
 * assertion was affected by the other's. T030 removed both paths from
 * `platform.openapi.yaml` for good — `170 - 2 = 168` is the count from
 * that point on, and there is no more overlap to collide harmlessly.
 *
 * ## Expected RED for operations 1-6 until the catalogue/lifecycle
 * workstream wires its own controller
 *
 * At the time this contract source was added (User Story 2/3, T027-T042),
 * `contracts/controls.openapi.yaml`'s operations 1-6 (catalog CRUD and
 * lifecycle) were implemented in `presentation/control.controller.ts` but
 * not yet registered in `controls.module.ts`'s own `controllers` array (a
 * file this task does not own) — so those six operations are genuinely
 * absent from `apps/api/openapi.json` and this test reports them missing
 * BY NAME, exactly as designed. Operations 7-18 (assessments/attestation
 * and process/asset/risk relationships) are this task's own scope and are
 * registered. Leaving `controls.openapi.yaml` out of this list until every
 * operation happened to be wired would silently forgo this whole contract's
 * F-31 coverage — the wrong trade, since the failure here names exactly
 * which operations are outstanding and by which workstream.
 *
 * ## 013-incidents-problems-reverse-links — 168 -> 198, and F-31 recurring a THIRD time
 *
 * `incidents.openapi.yaml`/`problems.openapi.yaml` (008-incidents-problems) shipped a whole phase
 * earlier WITHOUT being added to `CONTRACT_SOURCES` below — the identical F-31 omission this file's
 * own header already recounts once for `audit.openapi.yaml`, now recurring a third time, on the
 * very gate meant to catch it (`specs/008-incidents-problems/STATE.md` §2.1). Both join
 * `CONTRACT_SOURCES` here, in the SAME change that adds four new reverse-read GET operations
 * (`listRiskIncidentLinks`/`listRiskProblemLinks` to `risks.openapi.yaml`,
 * `listAssetIncidentLinks` to `assets.openapi.yaml`, `listProcessIncidentLinks` to
 * `processes.openapi.yaml`) surfacing Incident/Problem links from the Risk/Asset/Process side.
 * The new total, 198, is not computed here or anywhere else — the sanity-check test below states
 * plainly that it was read off a failing run of its own assertion, precisely so this number is
 * never again "derived" from an assumed prior total the way 168 was inherited unchecked through
 * several prior additions.
 *
 * ## 009-indicators-reports (T068) — 198 -> 211
 *
 * `indicators.openapi.yaml` (eight operations) and `reports.openapi.yaml` (five operations) join
 * `CONTRACT_SOURCES` here, in the SAME change that implements the five operations that were
 * missing from the running application (`listIndicatorMetricKeys`/`getIndicatorDefinition`/
 * `updateIndicatorDefinition`/`getReportDefinition`/`updateReportDefinition`) — this is what this
 * gate is FOR: a contract is added once every operation it declares is registered, never before.
 * 211 was read off a failing run of the assertion below immediately after adding these two
 * entries, the same discipline the 198 total above documents adopting — not `198 + 8 + 5`
 * reasoned by hand.
 *
 * ## Action audit trail (`GET /actions/{actionId}/audit-events`) — 211 -> 212
 *
 * `grc-foundation.openapi.yaml` was already in `CONTRACT_SOURCES` (no new entry needed) — this
 * is the one new operation it declares, `listActionAuditEvents`, added in the SAME change that
 * implements `ActionAuditController`/`ListActionAuditEventsUseCase` (`grc/action/**`). 212 was
 * read off a failing run of the assertion below (`expected 212 to be 211`) immediately after
 * adding the operation, the same discipline every total above this one documents adopting —
 * never `211 + 1` reasoned by hand.
 *
 * ## Dashboard summary (`GET /dashboard/summary`) — 212 -> 213
 *
 * `platform.openapi.yaml` was already in `CONTRACT_SOURCES` — this is the one new operation it
 * declares, `getDashboardSummary`, added in the SAME change that implements
 * `DashboardSummaryController`/`GetDashboardSummaryUseCase` (`modules/dashboard/**`). 213 was
 * read off a failing run of the assertion below, same as every total above.
 *
 * ## Roles summary (`GET /admin/roles/summary`) — 213 -> 214
 *
 * 015-roles-permissions-surface (T018-T020). `admin.openapi.yaml` was already in
 * `CONTRACT_SOURCES` — this is the one new operation it declares, `getRolesSummary`, amended into
 * the document alongside the five role operations already there rather than into a contract file
 * of its own (which would have split one API surface across two documents and forced an edit to
 * `CONTRACT_SOURCES`, `openapi-documents.ts`'s `CONTRACT_DOCUMENTS` and `packages/api-types`'
 * `DOCUMENTS` — the three independent lists this file's own `openapi-documents.ts` sibling already
 * names as a standing hazard). Added in the SAME change that implements
 * `AdminRolesController.summary`/`GetRolesSummaryUseCase`, never "contract now, route later".
 * 214 was read off a failing run of the assertion below (`expected 214 to be 213`), the same
 * discipline every total above this one documents adopting — never `213 + 1` reasoned by hand.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly file: string;
}

const SPECS_ROOT = path.resolve(__dirname, '..', '..', '..', '..', 'specs');

const FOUNDATION_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '001-grc-platform-foundation',
  'contracts',
);

const GRC_FOUNDATION_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '002-shared-grc-foundation',
  'contracts',
);

const CONTROLS_MANAGEMENT_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '003-controls-management',
  'contracts',
);

const COMPLIANCE_MANAGEMENT_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '004-compliance-management',
  'contracts',
);

const AUDIT_FINDINGS_CONTRACTS_DIR = path.resolve(SPECS_ROOT, '005-audit-findings', 'contracts');

const ASSETS_PROCESSES_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '006-assets-processes',
  'contracts',
);

const INCIDENTS_PROBLEMS_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '008-incidents-problems',
  'contracts',
);

const INDICATORS_REPORTS_CONTRACTS_DIR = path.resolve(
  SPECS_ROOT,
  '009-indicators-reports',
  'contracts',
);

// Each hand-authored contract document, paired with the directory it lives
// in. Extending this list is how a future phase's contract joins the same
// mirror check — see the file header for why this is a line scanner rather
// than a YAML parser.
const CONTRACT_SOURCES: readonly { readonly dir: string; readonly file: string }[] = [
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'admin.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'auth.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'platform.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'risks.openapi.yaml' },
  { dir: GRC_FOUNDATION_CONTRACTS_DIR, file: 'grc-foundation.openapi.yaml' },
  { dir: CONTROLS_MANAGEMENT_CONTRACTS_DIR, file: 'controls.openapi.yaml' },
  // 004-compliance-management — the third business module's contract,
  // joining this mirror check now that all 23 of its operations exist
  // (Fase 3-5, User Story 1-3) — the previous workstream (User Story 1)
  // deliberately deferred adding this entry to whichever task completed
  // the whole contract, per that phase's own tasks.md.
  { dir: COMPLIANCE_MANAGEMENT_CONTRACTS_DIR, file: 'compliance.openapi.yaml' },
  // 005-audit-findings — the fourth business module's contract. This entry
  // was missing for the whole of Phase 4 despite the contract's other 18
  // operations being implemented and registered — the exact F-31 defect
  // this test exists to catch, recurring on the gate meant to catch it
  // (see this file's own header, "F-31 recurred here"). Added once the two
  // operations it had been silently missing
  // (`listAuditEngagementFindings`/`createFindingFromEngagement`) were
  // implemented, not before.
  { dir: AUDIT_FINDINGS_CONTRACTS_DIR, file: 'audit.openapi.yaml' },
  // 006-assets-processes — the fifth and sixth business modules' contracts,
  // added in the SAME task (T022/T023) that registers `AssetController`/
  // `ProcessController` — see this file's own header, "006-assets-processes
  // — the fifth and sixth business modules, +12", for why this is not the
  // F-31 omission recurring a third time.
  { dir: ASSETS_PROCESSES_CONTRACTS_DIR, file: 'assets.openapi.yaml' },
  { dir: ASSETS_PROCESSES_CONTRACTS_DIR, file: 'processes.openapi.yaml' },
  // 008-incidents-problems — the seventh and eighth business modules'
  // contracts. Missing from this list for the entire phase despite being
  // fully implemented and registered: the exact F-31 defect this test
  // exists to catch, recurring a THIRD time on the gate meant to catch it
  // (`specs/008-incidents-problems/STATE.md` §2.1 records the omission;
  // this entry closes it). Added alongside the two new reverse-read
  // operations 013-incidents-problems-reverse-links adds to
  // `risks.openapi.yaml`/`assets.openapi.yaml`/`processes.openapi.yaml`
  // above, so every contract touched by that phase is covered by this gate
  // in the SAME change, not "added later" (this file's own header, "F-31
  // recurred here").
  { dir: INCIDENTS_PROBLEMS_CONTRACTS_DIR, file: 'incidents.openapi.yaml' },
  { dir: INCIDENTS_PROBLEMS_CONTRACTS_DIR, file: 'problems.openapi.yaml' },
  // 009-indicators-reports — the ninth and tenth business modules'
  // contracts. `IndicatorController`/`ReportController` already covered
  // most of their operations across Fase 3/4/7; the three/two remaining
  // per contract (`listIndicatorMetricKeys`/`getIndicatorDefinition`/
  // `updateIndicatorDefinition`, `getReportDefinition`/
  // `updateReportDefinition`) were the exact defect this file exists to
  // catch — declared, never implemented (this task's own instruction, not
  // a recurrence found after the fact this time: both entries are added
  // in the SAME change that implements the last operation of each
  // contract, per the discipline `INCIDENTS_PROBLEMS_CONTRACTS_DIR`'s own
  // entries above were added to enforce going forward).
  { dir: INDICATORS_REPORTS_CONTRACTS_DIR, file: 'indicators.openapi.yaml' },
  { dir: INDICATORS_REPORTS_CONTRACTS_DIR, file: 'reports.openapi.yaml' },
];

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const SERVER_URL_LINE = /^ {2}- url:\s*(\S+)\s*$/;
const PATHS_SECTION_START = /^paths:\s*$/;
const TOP_LEVEL_KEY = /^[A-Za-z]/;
const PATH_KEY_LINE = /^ {2}(\/\S*):\s*$/;
const METHOD_KEY_LINE = /^ {4}(get|post|put|patch|delete):\s*$/;

function extractContractOperations(dir: string, file: string): ContractOperation[] {
  const fullPath = path.resolve(dir, file);
  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);

  let serverPrefix = '';
  let insidePathsSection = false;
  let currentPath: string | null = null;
  const operations: ContractOperation[] = [];

  for (const line of lines) {
    const serverMatch = SERVER_URL_LINE.exec(line);
    if (serverMatch && serverPrefix === '') {
      serverPrefix = serverMatch[1]!;
    }

    if (PATHS_SECTION_START.test(line)) {
      insidePathsSection = true;
      continue;
    }
    if (insidePathsSection && TOP_LEVEL_KEY.test(line)) {
      // A new top-level key (e.g. `components:`) ends the `paths:` section.
      insidePathsSection = false;
    }
    if (!insidePathsSection) {
      continue;
    }

    const pathMatch = PATH_KEY_LINE.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1]!;
      continue;
    }

    const methodMatch = METHOD_KEY_LINE.exec(line);
    if (methodMatch && currentPath) {
      operations.push({
        method: methodMatch[1]!.toUpperCase(),
        path: serverPrefix + currentPath,
        file,
      });
    }
  }

  if (serverPrefix === '') {
    throw new Error(`${file}: no "servers: - url: ..." line found — cannot compute route paths.`);
  }

  return operations;
}

function loadContractedOperations(): readonly ContractOperation[] {
  return CONTRACT_SOURCES.flatMap(({ dir, file }) => extractContractOperations(dir, file));
}

function loadRegisteredOperationKeys(): ReadonlySet<string> {
  const committedPath = path.resolve(__dirname, '..', '..', 'openapi.json');
  const doc = JSON.parse(readFileSync(committedPath, 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const registered = new Set<string>();
  for (const [routePath, methods] of Object.entries(doc.paths)) {
    for (const method of Object.keys(methods)) {
      if (HTTP_METHODS.has(method)) {
        registered.add(`${method.toUpperCase()} ${routePath}`);
      }
    }
  }
  return registered;
}

describe('Every contracted operation is registered in the application (T093, F-31)', () => {
  it('parses exactly 214 operations from the fourteen hand-authored contracts (sanity check on the parser itself)', () => {
    const contracted = loadContractedOperations();
    // 213, not an arithmetic total someone reasoned their way to from 198:
    // this number was READ OFF a failing run of this same assertion after
    // `indicators.openapi.yaml` (eight operations)/`reports.openapi.yaml`
    // (five operations) joined `CONTRACT_SOURCES` below (009-indicators-
    // reports, T068) — see this file's own header, "009-indicators-reports
    // (T068) — 198 -> 211", for why this is the discipline the gate exists
    // to enforce, not a recurrence of the F-31 omission it caught three
    // times before. It then moved to 212 with the Action audit trail —
    // documented in this file's own header under "Action audit trail
    // (`GET /actions/{actionId}/audit-events`) — 211 -> 212", read off that
    // change's own failing run. (A first draft of this comment blamed that
    // step on an unrelated reverse-links change that never touched this
    // number; the header is the record, and it says otherwise.) This task's
    // own addition — `getDashboardSummary` (`GET /dashboard/summary`, one
    // operation) — is the `212 -> 213` step, read off THIS run's own
    // failure, not calculated by hand. 015-roles-permissions-surface's
    // `getRolesSummary` (`GET /admin/roles/summary`, one operation) is the
    // `213 -> 214` step, read off ITS own failing run
    // (`expected 214 to be 213`) — see this file's header.
    expect(contracted.length).toBe(214);
  });

  it('registers every operation the hand-authored contracts declare — a route promised by the contract but never implemented fails HERE, by name', () => {
    const contracted = loadContractedOperations();
    const registered = loadRegisteredOperationKeys();

    const missing = contracted
      .filter((operation) => !registered.has(`${operation.method} ${operation.path}`))
      .map((operation) => `${operation.method} ${operation.path} (${operation.file})`)
      .sort();

    // An empty array assertion failure prints every missing operation by
    // name — see the file header for why this direction of comparison is
    // the one F-31 needed and did not have.
    expect(missing).toEqual([]);
  });
});
