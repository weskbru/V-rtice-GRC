import { expect } from 'vitest';

import { matchOperationForRequest } from './openapi-documents';
import { resolveResponseSchema, validateResponseBody } from './payload-validator';

import type { ContractOperation } from './openapi-documents';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';

const API_PATH_PREFIX = '/api/v1';

export interface PayloadViolation {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
  readonly status: number;
  readonly errors: readonly string[];
}

export interface UndocumentedStatusFinding {
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
  readonly status: number;
}

export interface UncontractedRouteFinding {
  readonly method: string;
  readonly path: string;
}

let violations: PayloadViolation[] = [];
let undocumentedStatuses: UndocumentedStatusFinding[] = [];
const uncontractedRoutes: UncontractedRouteFinding[] = [];
const coveredOperations = new Set<string>();

export function readAllRecordedFindings(): {
  readonly violations: readonly PayloadViolation[];
  readonly undocumentedStatuses: readonly UndocumentedStatusFinding[];
  readonly uncontractedRoutes: readonly UncontractedRouteFinding[];
  readonly coveredOperationCount: number;
} {
  return {
    violations,
    undocumentedStatuses,
    uncontractedRoutes,
    coveredOperationCount: coveredOperations.size,
  };
}

function stripApiPrefix(rawPath: string): string {
  return rawPath.startsWith(API_PATH_PREFIX)
    ? rawPath.slice(API_PATH_PREFIX.length) || '/'
    : rawPath;
}

function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }
  return (
    contentType.includes('application/json') || contentType.includes('application/problem+json')
  );
}

function recordForOperation(
  operation: ContractOperation,
  method: string,
  path: string,
  status: number,
  body: unknown,
): void {
  const lookup = resolveResponseSchema(operation, status);
  if (!lookup) {
    undocumentedStatuses.push({ method, path, operationId: operation.operationId, status });
    return;
  }

  const result = validateResponseBody(operation, status, body);
  if (!result.valid) {
    violations.push({
      method,
      path,
      operationId: operation.operationId,
      status,
      errors: result.errors,
    });
  }
}

export function installResponseValidation(app: NestExpressApplication): void {
  app.use((req: Request, res: Response, next: () => void) => {
    let capturedBody: unknown;
    let captured = false;

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      capturedBody = body;
      captured = true;
      return originalJson(body);
    }) as typeof res.json;

    const originalSend = res.send.bind(res);
    res.send = ((body: unknown) => {
      if (!captured) {
        capturedBody = body;
        captured = true;
      }
      return originalSend(body);
    }) as typeof res.send;

    res.on('finish', () => {
      const path = stripApiPrefix(req.path);
      const operation = matchOperationForRequest(req.method, path);
      if (!operation) {
        uncontractedRoutes.push({ method: req.method, path });
        return;
      }
      coveredOperations.add(`${operation.documentKey}:${operation.operationId}`);

      if (!captured) {
        return;
      }

      const contentType = res.getHeader('content-type');
      if (!isJsonContentType(typeof contentType === 'string' ? contentType : undefined)) {
        return;
      }

      let body = capturedBody;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return;
        }
      }

      recordForOperation(operation, req.method, path, res.statusCode, body);
    });

    next();
  });
}

function drain(): {
  readonly violations: readonly PayloadViolation[];
  readonly undocumentedStatuses: readonly UndocumentedStatusFinding[];
} {
  const drained = { violations, undocumentedStatuses };
  violations = [];
  undocumentedStatuses = [];
  return drained;
}

function formatViolation(violation: PayloadViolation): string {
  return (
    `${violation.method} ${violation.path} -> ${violation.operationId} [${String(violation.status)}]\n` +
    violation.errors.map((e) => `    ${e}`).join('\n')
  );
}

export function assertNoResponseValidationViolations(): void {
  const { violations: testViolations, undocumentedStatuses: testUndocumented } = drain();

  if (testUndocumented.length > 0) {
    console.warn(
      'Response(s) with a status code not documented on their matched operation:\n' +
        testUndocumented
          .map((f) => `  ${f.method} ${f.path} -> ${f.operationId} [${String(f.status)}]`)
          .join('\n'),
    );
  }

  expect(testViolations, testViolations.map(formatViolation).join('\n\n')).toEqual([]);
}
