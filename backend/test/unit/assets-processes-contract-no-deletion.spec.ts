import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ASSETS_CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../specs/006-assets-processes/contracts/assets.openapi.yaml',
);
const PROCESSES_CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../specs/006-assets-processes/contracts/processes.openapi.yaml',
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
