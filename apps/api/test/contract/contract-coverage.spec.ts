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

const CONTRACT_SOURCES: readonly { readonly dir: string; readonly file: string }[] = [
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'admin.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'auth.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'platform.openapi.yaml' },
  { dir: FOUNDATION_CONTRACTS_DIR, file: 'risks.openapi.yaml' },
  { dir: GRC_FOUNDATION_CONTRACTS_DIR, file: 'grc-foundation.openapi.yaml' },
  { dir: CONTROLS_MANAGEMENT_CONTRACTS_DIR, file: 'controls.openapi.yaml' },
  { dir: COMPLIANCE_MANAGEMENT_CONTRACTS_DIR, file: 'compliance.openapi.yaml' },
  { dir: AUDIT_FINDINGS_CONTRACTS_DIR, file: 'audit.openapi.yaml' },
  { dir: ASSETS_PROCESSES_CONTRACTS_DIR, file: 'assets.openapi.yaml' },
  { dir: ASSETS_PROCESSES_CONTRACTS_DIR, file: 'processes.openapi.yaml' },
  { dir: INCIDENTS_PROBLEMS_CONTRACTS_DIR, file: 'incidents.openapi.yaml' },
  { dir: INCIDENTS_PROBLEMS_CONTRACTS_DIR, file: 'problems.openapi.yaml' },
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
    expect(contracted.length).toBe(214);
  });

  it('registers every operation the hand-authored contracts declare — a route promised by the contract but never implemented fails HERE, by name', () => {
    const contracted = loadContractedOperations();
    const registered = loadRegisteredOperationKeys();

    const missing = contracted
      .filter((operation) => !registered.has(`${operation.method} ${operation.path}`))
      .map((operation) => `${operation.method} ${operation.path} (${operation.file})`)
      .sort();

    expect(missing).toEqual([]);
  });
});
