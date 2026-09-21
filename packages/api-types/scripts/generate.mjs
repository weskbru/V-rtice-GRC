#!/usr/bin/env node
/**
 * Generates `src/generated/{auth,admin,platform,risks,grcfoundation,controls,
 * compliance,audit,assets,processes,incidents,problems,indicators,
 * reports}.ts` from the hand-authored OpenAPI contracts in
 * `specs/001-grc-platform-foundation/contracts/`,
 * `specs/002-shared-grc-foundation/contracts/`,
 * `specs/003-controls-management/contracts/`,
 * `specs/004-compliance-management/contracts/`,
 * `specs/005-audit-findings/contracts/`,
 * `specs/006-assets-processes/contracts/`,
 * `specs/008-incidents-problems/contracts/` and
 * `specs/009-indicators-reports/contracts/`, using `openapi-typescript`.
 *
 * research.md D-8 (007-implementation-remediation): extended from the five
 * documents this generator originally covered (Auth/Admin/Platform/Risks/
 * GrcFoundation) to all ten contracts the product shipped at the time —
 * Controls, Compliance, Audit and Assets/Processes were previously left to
 * hand-written frontend types with no generated cross-check at all.
 *
 * Incidents and Problems (008-incidents-problems) extended it again, to
 * twelve, while their own backend and Prisma schema were still being built
 * by a separate front — this generator's only input is the hand-authored
 * contract, never the running API, so it has nothing to wait for. The
 * frontend-facing scaffold this enables (coordinator instruction,
 * 2026-09-11, this phase) is meant to be the first module in this
 * repository whose transport types and API client are generated from day
 * one, never a hand-written mirror that could drift from the contract.
 *
 * Indicators and Reports (009-indicators-reports) extended it a third time,
 * to fourteen, ahead of their own backend for the same reason as Incidents
 * and Problems: the contract is the only input this generator needs.
 *
 * Why the contracts, not `apps/api/openapi.json` (D-14 in
 * `docs/local-environment.md`, finding F-3 in `docs/deferred-findings.md`):
 * `apps/api/openapi.json` is produced by reflecting NestJS decorators, and no
 * DTO in this codebase carries `@ApiProperty`, so every one of its component
 * schemas is `{"type":"object","properties":{}}` — routes described, not one
 * field. The hand-authored contracts are complete at field level and are
 * what this project treats as authoritative when the two disagree (D-5).
 * `apps/api/openapi.json` / `openapi:check` remain a route-level drift
 * detector; they are not this package's input.
 *
 * Combining strategy — one namespace per document, not a merged surface:
 * the contracts are independently authored and share several schema
 * names (`Problem`, `FieldError`, `PageMeta`, `OrgUnitRef`, `RoleRef`,
 * `RiskLevel`) that are structurally identical, and at least one
 * (`UserRef`) that is NOT — admin.openapi.yaml's `UserRef` additionally
 * requires `email` and carries `jobTitle`/`primaryOrgUnit`, while
 * platform.openapi.yaml's, risks.openapi.yaml's AND
 * grc-foundation.openapi.yaml's own `UserRef` do not. `OrgUnitRef` is
 * ANOTHER such divergence, found by the assurance audit that added
 * `GrcFoundation` here: risks.openapi.yaml's `OrgUnitRef` requires `code`
 * in addition to `id`/`name`, while grc-foundation.openapi.yaml's does not
 * — `features/evidence/types.ts` and `features/findings/types.ts` had been
 * importing the RISKS-domain `OrgUnitRef` for a shape their own API never
 * actually returns (Fix 3). Merging into one flat `components["schemas"]`
 * would silently let one definition win in cases exactly like this one.
 * Generating each document into its own namespace (`Auth`, `Admin`,
 * `Platform`, `Risks`, `GrcFoundation`) preserves each document's actual,
 * possibly-divergent schemas instead of hiding the disagreement.
 *
 * `indicators.openapi.yaml` and `reports.openapi.yaml` each define their own
 * `UserRef` too — checked against every prior document's `UserRef` before
 * being added here: both are the same `{id, fullName}` required /
 * `email` optional shape already used by Platform, Risks, GrcFoundation,
 * Incidents and Problems, not the Admin-only shape that additionally
 * requires `email` and carries `jobTitle`/`primaryOrgUnit`. Not a new
 * divergence, but kept in their own `Indicators`/`Reports` namespaces
 * regardless, for the same reason as every other document here: the
 * generator does not merge schemas across documents on the strength of a
 * shared name.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const specsRoot = path.resolve(packageRoot, '../../specs');
const generatedDir = path.resolve(packageRoot, 'src/generated');

// Namespace name -> { specDir, file }. Order mirrors the four
//001-grc-platform-foundation documents named in the T205 task and in
// `specs/001-grc-platform-foundation/contracts/README.md`, followed by the
// 002-shared-grc-foundation contract added for the assurance-audit Fix 3,
// followed by the five documents added by research.md D-8
// (007-implementation-remediation) to bring every implemented contract under
// this generator — Controls, Compliance, Audit, Assets and Processes —
// followed by Incidents and Problems (008-incidents-problems), added ahead
// of their own backend so the frontend scaffold has a generated namespace
// to build against instead of a hand-written mirror, followed by
// Indicators and Reports (009-indicators-reports), added the same way and
// for the same reason.
//
// One namespace per document, never merged (D-8): `UserRef` has five
// genuinely different shapes across the first ten documents, `OrgUnitRef`
// has two families, and `VersionConflictProblem` differs in both its
// required fields and the enum it references. Fusing homonymous schemas
// would silently pick one shape and mistype every consumer of the others.
// Incidents and Problems add their own instance of the same hazard:
// `problems.openapi.yaml`'s `IncidentRef`/`IncidentStatusRef` and
// `incidents.openapi.yaml`'s `ProblemRef`/`ProblemStatusRef` are each the
// OTHER document's own read-only projection of the linked record, not
// reused from anywhere — kept in their own namespaces for the same reason.
const DOCUMENTS = [
  { namespace: 'Auth', specDir: '001-grc-platform-foundation', file: 'auth.openapi.yaml' },
  { namespace: 'Admin', specDir: '001-grc-platform-foundation', file: 'admin.openapi.yaml' },
  { namespace: 'Platform', specDir: '001-grc-platform-foundation', file: 'platform.openapi.yaml' },
  { namespace: 'Risks', specDir: '001-grc-platform-foundation', file: 'risks.openapi.yaml' },
  {
    namespace: 'GrcFoundation',
    specDir: '002-shared-grc-foundation',
    file: 'grc-foundation.openapi.yaml',
  },
  { namespace: 'Controls', specDir: '003-controls-management', file: 'controls.openapi.yaml' },
  {
    namespace: 'Compliance',
    specDir: '004-compliance-management',
    file: 'compliance.openapi.yaml',
  },
  { namespace: 'Audit', specDir: '005-audit-findings', file: 'audit.openapi.yaml' },
  { namespace: 'Assets', specDir: '006-assets-processes', file: 'assets.openapi.yaml' },
  { namespace: 'Processes', specDir: '006-assets-processes', file: 'processes.openapi.yaml' },
  {
    namespace: 'Incidents',
    specDir: '008-incidents-problems',
    file: 'incidents.openapi.yaml',
  },
  { namespace: 'Problems', specDir: '008-incidents-problems', file: 'problems.openapi.yaml' },
  {
    namespace: 'Indicators',
    specDir: '009-indicators-reports',
    file: 'indicators.openapi.yaml',
  },
  { namespace: 'Reports', specDir: '009-indicators-reports', file: 'reports.openapi.yaml' },
];

function fail(message) {
  console.error(`\n${message}\n`);
  process.exitCode = 1;
}

function header(sourceRelPath) {
  return [
    // This file is now `.ts`, not `.d.ts` (see the comment at its own write
    // site in `generateOne` for why) — the root `eslint.config.mjs`'s
    // blanket `**/*.d.ts` ignore no longer excludes it, and
    // `openapi-typescript`'s own generated style (index-signature response
    // header maps, e.g. `{ [name: string]: unknown }`) does not conform to
    // this monorepo's hand-written-code style rule. Disabled inline, at the
    // TOP of the generated content itself, rather than by editing the
    // shared root `eslint.config.mjs` for one generated corner of one
    // package — this keeps the accommodation co-located with the content it
    // exists for, and it is regenerated (never hand-maintained) exactly
    // like everything else in this file.
    '/* eslint-disable @typescript-eslint/consistent-indexed-object-style */',
    '/**',
    ' * GENERATED FILE — DO NOT EDIT BY HAND.',
    ' *',
    ' * Generated by `pnpm --filter @pharos/api-types run generate`',
    ' * (packages/api-types/scripts/generate.mjs), from:',
    ` *   ${sourceRelPath}`,
    ' *',
    ' * Re-run the command above after changing that contract. Hand edits here',
    ' * are silently discarded the next time it runs.',
    ' */',
    '',
  ].join('\n');
}

async function generateOne({ namespace, specDir, file }, openapiTS, astToString) {
  const sourcePath = path.resolve(specsRoot, specDir, 'contracts', file);
  const sourceRelPath = path.relative(packageRoot, sourcePath).split(path.sep).join('/');

  if (!existsSync(sourcePath)) {
    throw new Error(`Contract not found: expected it at ${sourcePath}`);
  }

  // `openapi-typescript` (via its Redoc-based bundler) resolves a plain path
  // STRING as a URL and mis-parses a Windows absolute path (e.g. `C:\...` or
  // `C:/...`) as a foreign scheme, silently producing an empty parsed
  // document and failing with "Unsupported schema format, expected
  // `openapi: 3.x`" even though the file's `openapi` field is present and
  // valid. A `file://` URL — what this library's own success path expects —
  // sidesteps that string-parsing entirely and works identically on
  // Windows/macOS/Linux.
  const ast = await openapiTS(pathToFileURL(sourcePath));
  const contents = astToString(ast);

  // `.ts`, deliberately NOT `.d.ts` (assurance-audit Fix 3 finding): `tsc`
  // treats an input `.d.ts` as an ambient type SOURCE for the current
  // compilation only — it never copies/re-emits it into `outDir`. With
  // this package's own `tsconfig.json` (`include: ["src/**/*.ts"]`,
  // `declaration: true`), the generated files being `.d.ts` meant `pnpm
  // --filter @pharos/api-types run build` produced `dist/index.d.ts`
  // re-exporting `./generated/auth` etc. that never actually existed in
  // `dist/` — `@pharos/api-types` was unusable by ANY consumer for every
  // one of its namespaced types since the day it was introduced, which is
  // the real reason nothing in `apps/web` had ever imported from it.
  // Content-wise this file is plain exported `interface`/`type`
  // declarations (no `declare` blocks) — valid, ordinary `.ts` source that
  // `tsc` compiles and actually emits a matching `.d.ts` for.
  const outputPath = path.resolve(generatedDir, `${namespace.toLowerCase()}.ts`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, header(sourceRelPath) + contents, 'utf-8');

  return { namespace, outputPath, sourceRelPath };
}

function indexContents(results) {
  const lines = [
    '/**',
    ' * GENERATED FILE — DO NOT EDIT BY HAND.',
    ' *',
    ' * Generated by `pnpm --filter @pharos/api-types run generate`',
    ' * (packages/api-types/scripts/generate.mjs), from the fourteen hand-authored',
    " * contracts listed in that script's own DOCUMENTS array (one per",
    ' * specs/<phase>/contracts/ folder). Each contract gets its own namespace',
    ' * below rather than being merged into one, because the documents share',
    ' * schema names (e.g. `UserRef`) that are not always structurally',
    ' * identical — see the comment at the top of generate.mjs.',
    ' */',
    '',
  ];
  for (const { namespace, sourceRelPath } of results) {
    lines.push(`// From ${sourceRelPath}`);
    lines.push(`export type * as ${namespace} from './generated/${namespace.toLowerCase()}';`);
  }
  lines.push('');
  return lines.join('\n');
}

try {
  const { default: openapiTS, astToString } = await import('openapi-typescript');

  const results = [];
  for (const doc of DOCUMENTS) {
    results.push(await generateOne(doc, openapiTS, astToString));
  }

  const indexPath = path.resolve(packageRoot, 'src/index.ts');
  await writeFile(indexPath, indexContents(results), 'utf-8');

  for (const { namespace, outputPath } of results) {
    console.log(`Generated ${path.relative(packageRoot, outputPath)} (namespace ${namespace})`);
  }
  console.log(`Generated ${path.relative(packageRoot, indexPath)}`);
} catch (error) {
  fail(
    [
      'Failed to generate API types from the fourteen *.openapi.yaml contracts ' +
        "listed in this script's own DOCUMENTS array (specs/*/contracts/).",
      '',
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    ].join('\n'),
  );
}
