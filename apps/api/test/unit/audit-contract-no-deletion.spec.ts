import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = path.resolve(
  __dirname,
  '../../../../specs/005-audit-findings/contracts/audit.openapi.yaml',
);

const AUDIT_ENGAGEMENTS_PRESENTATION = path.resolve(
  __dirname,
  '../../src/modules/audit-engagements/presentation',
);

const PATH_KEY_LINE = /^ {2}(\/\S*):\s*$/;
const METHOD_KEY_LINE = /^ {4}(get|post|put|patch|delete):\s*$/;
const OPERATION_ID_LINE = /^ {6}operationId:\s*(\S+)\s*$/;
const RESPONSE_CODE_LINE = /^ {8}'(\d{3})':\s*$/;

interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
  readonly responseCodes: readonly string[];
}

function parseOperations(): readonly ContractOperation[] {
  const lines = fs.readFileSync(CONTRACT_PATH, 'utf8').split(/\r?\n/);

  const operations: ContractOperation[] = [];
  let currentPath: string | null = null;
  let currentMethod: string | null = null;
  let currentOperationId: string | null = null;
  let currentResponses: string[] = [];

  const flush = (): void => {
    if (currentPath && currentMethod && currentOperationId) {
      operations.push({
        method: currentMethod.toUpperCase(),
        path: currentPath,
        operationId: currentOperationId,
        responseCodes: [...currentResponses],
      });
    }
    currentMethod = null;
    currentOperationId = null;
    currentResponses = [];
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

    const responseMatch = RESPONSE_CODE_LINE.exec(line);
    if (responseMatch && currentMethod) {
      currentResponses.push(responseMatch[1]!);
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

describe('005-audit-findings contract destroys nothing (FR-012, SC-005)', () => {
  const operations = parseOperations();

  it('parses the contract — the scan is not vacuously empty', () => {
    expect(operations.length).toBe(20);
    expect(operations.filter((operation) => operation.method === 'GET').length).toBeGreaterThan(0);
  });

  it('declares exactly two DELETE verbs, and both are link withdrawals', () => {
    const deletes = operations.filter((operation) => operation.method === 'DELETE');

    expect(deletes.map((operation) => operation.operationId).sort()).toEqual([
      'unlinkFindingFromControl',
      'unlinkFindingFromRisk',
    ]);
  });

  it('both withdrawals return 200 with a body, never 204 — the row is preserved, not destroyed', () => {
    const deletes = operations.filter((operation) => operation.method === 'DELETE');

    for (const operation of deletes) {
      expect(operation.responseCodes).toContain('200');
      expect(operation.responseCodes).not.toContain('204');
    }
  });

  it('declares no DELETE of an engagement, a finding, or a scope entry', () => {
    const forbidden = operations.filter(
      (operation) =>
        operation.method === 'DELETE' &&
        (operation.path === '/audits/{auditId}' ||
          operation.path === '/findings/{findingId}' ||
          operation.path.startsWith('/audits/{auditId}/scope')),
    );

    expect(forbidden.map((operation) => `${operation.method} ${operation.path}`)).toEqual([]);
  });

  it('registers no @Delete route anywhere under modules/audit-engagements/presentation', () => {
    const offenders = listTsFiles(AUDIT_ENGAGEMENTS_PRESENTATION)
      .filter((file) => /@Delete\s*\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.basename(file));

    expect(offenders).toEqual([]);
  });

  it('actually scanned the audit-engagements presentation layer — not an empty directory', () => {
    expect(listTsFiles(AUDIT_ENGAGEMENTS_PRESENTATION).length).toBeGreaterThan(5);
  });
});
