/**
 * T057/006-assets-processes — FR-012/SC-004, the structural proof that no
 * deletion exists anywhere in this feature: zero `delete:` HTTP verbs in
 * either contract, and no `@Delete` route under `modules/assets` or
 * `modules/processes`. Modelled directly on
 * `audit-contract-no-deletion.spec.ts` (005-audit-findings) — same line
 * scanner, same non-vacuity guards, same two-direction reasoning (a
 * contract-side scan alone cannot see a repository method that deletes a
 * row behind an innocuous-looking route; a code-side scan alone cannot see
 * an operation that was promised in the contract but never built) —
 * extended to TWO contracts and TWO module directories, since this
 * feature promotes TWO domains (Asset, Process) in lockstep (FR-020).
 *
 * ## What this asserts
 *
 * 1. Neither `assets.openapi.yaml` nor `processes.openapi.yaml` declares a
 *    single `delete:` HTTP verb anywhere — the only two state transitions
 *    either resource has are `.../deactivate` and `.../reactivate`, both
 *    `POST` (data-model.md §3, quickstart.md §6). Unlike
 *    005-audit-findings' contract (which legitimately has two DELETE verbs
 *    for link WITHDRAWAL, returning `200` with a body), this feature has
 *    NONE at all — Asset/Process links are withdrawn from the RISK/CONTROL
 *    side of the relationship, never from here (`assets.ts`'s own
 *    `linkedRisks`/`linkedControls` doc comment: "não há ação de
 *    vincular/desvincular nesta seção, deliberadamente").
 * 2. Neither module's presentation layer registers a single `@Delete`
 *    route.
 * 3. Neither module's implementation calls `prisma.asset.delete` /
 *    `prisma.process.delete` anywhere (infrastructure layer, not only
 *    presentation) — the same grep quickstart.md §6 runs by hand, run here
 *    as an automated assertion instead.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ASSETS_CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../../specs/006-assets-processes/contracts/assets.openapi.yaml',
);
const PROCESSES_CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../../specs/006-assets-processes/contracts/processes.openapi.yaml',
);

const ASSETS_MODULE_ROOT = path.resolve(__dirname, '../../src/modules/assets');
const PROCESSES_MODULE_ROOT = path.resolve(__dirname, '../../src/modules/processes');

const PATH_KEY_LINE = /^ {2}(\/\S*):\s*$/;
const METHOD_KEY_LINE = /^ {4}(get|post|put|patch|delete):\s*$/;
const OPERATION_ID_LINE = /^ {6}operationId:\s*(\S+)\s*$/;

interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
}

/** The exact same deliberate line scanner `audit-contract-no-deletion.spec.ts`
 * and `contract-coverage.spec.ts` use — no YAML parser is a dependency of
 * `apps/api`, and adding one as a second consumer for a single test would
 * be exactly the unjustified dependency CLAUDE.md §2 forbids. */
function parseOperations(contractPath: string): readonly ContractOperation[] {
  const lines = fs.readFileSync(contractPath, 'utf8').split(/\r?\n/);

  const operations: ContractOperation[] = [];
  let currentPath: string | null = null;
  let currentMethod: string | null = null;
  let currentOperationId: string | null = null;

  const flush = (): void => {
    if (currentPath && currentMethod && currentOperationId) {
      operations.push({
        method: currentMethod.toUpperCase(),
        path: currentPath,
        operationId: currentOperationId,
      });
    }
    currentMethod = null;
    currentOperationId = null;
  };

  for (const line of lines) {
    const pathMatch = PATH_KEY_LINE.exec(line);
    if (pathMatch) {
      flush();
      currentPath = pathMatch[1]!;
      continue;
    }

    const methodMatch = METHOD_KEY_LINE.exec(line);
    if (methodMatch) {
      flush();
      currentMethod = methodMatch[1]!;
      continue;
    }

    const operationIdMatch = OPERATION_ID_LINE.exec(line);
    if (operationIdMatch && currentMethod) {
      currentOperationId = operationIdMatch[1]!;
      continue;
    }
  }
  flush();

  return operations;
}

function listTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe.each([
  {
    domain: 'Asset',
    contractPath: ASSETS_CONTRACT_PATH,
    moduleRoot: ASSETS_MODULE_ROOT,
    prismaModel: 'asset',
  },
  {
    domain: 'Process',
    contractPath: PROCESSES_CONTRACT_PATH,
    moduleRoot: PROCESSES_MODULE_ROOT,
    prismaModel: 'process',
  },
])('006-assets-processes contract destroys nothing (FR-012, SC-004) — $domain', (fixture) => {
  const operations = parseOperations(fixture.contractPath);

  // Guards the parser itself: if the scanner silently stopped matching,
  // every assertion below would pass over an empty list.
  //
  // 6 -> 7, 2026-09-11 (013-incidents-problems-reverse-links, commit
  // 2a39b52): each contract gained one new GET operation —
  // `listAssetIncidentLinks` (`GET /assets/{assetId}/incidents`) in
  // assets.openapi.yaml, `listProcessIncidentLinks`
  // (`GET /processes/{processId}/incidents`) in processes.openapi.yaml —
  // the read-only reverse of `IncidentAssetLink`/`IncidentProcessLink`,
  // a table this module has never written to and still does not. Not a
  // weakening of this guard: still an exact count, not a range or a
  // minimum, which would pass on a scan that found only one operation.
  it('parses the contract — the scan is not vacuously empty', () => {
    expect(operations.length).toBe(7);
    expect(operations.filter((operation) => operation.method === 'GET').length).toBeGreaterThan(0);
  });

  it('declares NO delete: HTTP verb anywhere — deactivate/reactivate are both POST', () => {
    const deletes = operations.filter((operation) => operation.method === 'DELETE');
    expect(deletes).toEqual([]);

    const transitions = operations.filter(
      (operation) => operation.path.endsWith('deactivate') || operation.path.endsWith('reactivate'),
    );
    expect(transitions.length).toBe(2);
    for (const transition of transitions) {
      expect(transition.method).toBe('POST');
    }
  });

  it("registers no @Delete route anywhere under the module's presentation layer", () => {
    const presentationRoot = path.join(fixture.moduleRoot, 'presentation');
    const offenders = listTsFiles(presentationRoot)
      .filter((file) => /@Delete\s*\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.basename(file));

    expect(offenders).toEqual([]);
  });

  it('actually scanned the presentation layer — not an empty directory', () => {
    const presentationRoot = path.join(fixture.moduleRoot, 'presentation');
    expect(listTsFiles(presentationRoot).length).toBeGreaterThan(0);
  });

  it(`never calls prisma.${fixture.prismaModel}.delete/deleteMany anywhere in the module`, () => {
    // Matched on `${model}.delete` rather than `prisma.${model}.delete` —
    // this module's repositories never spell the client access that way.
    // They hold `PrismaService` and call `this.prisma.client.<model>.<op>`
    // (see `get client()` in `infrastructure/prisma/prisma.service.ts`), so
    // a real offending call reads `this.prisma.client.asset.delete(...)`,
    // which does NOT contain the substring `prisma.asset.delete` — the
    // literal pattern quickstart.md §6 recommends running by hand. A
    // pattern anchored on that literal string would pass over a real
    // `prisma.client.asset.delete(...)` call in silence.
    //
    // `delete(Many)?` — NOT just `delete` — because `deleteMany` destroys
    // rows exactly as `delete` does; FR-012 does not carve out an exception
    // for the bulk form. A guard that only caught singular `delete` would
    // stay green forever against `asset.deleteMany(...)`, which nothing in
    // this module currently calls (confirmed by grep) but which nothing
    // stops someone from adding tomorrow. `delete`/`deleteMany` are the only
    // two operations a Prisma model delegate exposes that destroy rows — no
    // `remove`/`destroy` exists, and neither module issues `$executeRaw`/
    // `$queryRaw` (confirmed by grep), so there is no third path to cover.
    //
    // Leading and trailing `\b` anchor the match to the model's OWN
    // delegate, not a link table that happens to embed the model's name in
    // camelCase — `riskAssetLink.delete(...)`/`controlAssetLink.delete(...)`
    // (and their `deleteMany` forms) are legitimate: those two link tables
    // are how `RiskAssetLink`/`ControlAssetLink` withdrawal already works
    // elsewhere in the platform, and neither is owned by this module. They
    // do not match here regardless of `\b`, because the literal substring
    // `asset` (lowercase) never occurs inside `riskAssetLink`/
    // `controlAssetLink` — the embedded word is `Asset`, capitalized, and
    // this pattern is case-sensitive by construction. Verified concretely,
    // not by inspection alone: this exact regex was run by hand against
    // `riskAssetLink.delete(...)`, `controlAssetLink.delete(...)`,
    // `riskProcessLink.delete(...)`, `controlProcessLink.delete(...)` and
    // their `deleteMany` forms, and it matched none of them.
    const pattern = new RegExp(`\\b${fixture.prismaModel}\\.delete(?:Many)?\\b`);
    const offenders = listTsFiles(fixture.moduleRoot)
      .filter((file) => pattern.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(fixture.moduleRoot, file));

    expect(offenders).toEqual([]);
  });

  it('actually scanned the whole module — not an empty directory', () => {
    expect(listTsFiles(fixture.moduleRoot).length).toBeGreaterThan(5);
  });
});
