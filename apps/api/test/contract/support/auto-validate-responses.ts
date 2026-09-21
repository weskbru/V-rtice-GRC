/**
 * T032/D-9 (007-implementation-remediation) — automatic payload validation,
 * wired into the harness rather than hand-authored per operation.
 *
 * The coordinator's own framing, verbatim, is the design brief: "wire the
 * validator into the harness so that every response the existing contract
 * suite already produces is validated automatically against its own
 * operation's schema" — not 168 new hand-written requests duplicating
 * fixtures the suite's 48 files already built at real cost.
 *
 * ## Mechanism
 *
 * `installResponseValidation(app)` adds ONE piece of Express middleware,
 * first in the chain, to the real `NestExpressApplication`
 * `buildContractTestApp` already creates. It wraps `res.json`/`res.send` to
 * capture whatever body the application ultimately sends — success payload
 * or `application/problem+json` failure alike, through EVERY response path
 * (an ordinary controller return value, a `@Res()` controller, or
 * `ProblemDetailsFilter`) — then, once the response has actually finished,
 * matches the request's `{method, path}` against the ten contracts'
 * templated paths (`openapi-documents.ts`'s `matchOperationForRequest`,
 * itself agnostic of any test file) and validates the captured body against
 * that operation's schema for the status code actually returned
 * (`payload-validator.ts`'s `validateResponseBody`).
 *
 * `contract-app.ts` calls `installResponseValidation` from
 * `buildContractTestApp` and registers `assertNoResponseValidationViolations`
 * as a module-level `afterEach` — Vitest gives every test FILE its own
 * fresh module instance (`isolate: true` by default), so a hook registered
 * here at import time applies to the whole suite of whichever spec file
 * imports `contract-app.ts`, with ZERO edits to any of the 48 existing
 * spec files. This is what makes coverage track whatever the suite
 * genuinely exercises, not a fixed list someone remembered to enumerate.
 *
 * ## What is deliberately NOT validated
 *
 * - A response whose `{method, path}` matches no contracted operation at
 *   all (`matchOperationForRequest` returns `undefined`) — silently
 *   skipped. `contract-coverage.spec.ts` is the gate for "every contracted
 *   operation is implemented"; this is its mirror image ("every response
 *   this suite produced came from a contracted operation"), tracked
 *   separately below rather than conflated into a payload-shape failure.
 * - A response whose Content-Type is not `application/json` /
 *   `application/problem+json` (a binary download, a plain-text parser
 *   error) — skipped; FR-017 excludes these by design
 *   (`buildBodyExclusionInventory`).
 * - A status code the matched operation does not declare a schema for
 *   (e.g. an undocumented `500`) — skipped as a payload-shape check, but
 *   recorded as its own, separate "undocumented status" finding, because
 *   silently ignoring it would hide a real contract gap behind this file's
 *   own "nothing to validate" logic.
 */
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
// Every `documentKey:operationId` this run matched at least once, REGARDLESS
// of validation outcome — this is the "how much of the suite's real traffic
// did the validator actually see" measurement the coordinator asked for,
// answerable only by running the suite, never by reading the contracts.
const coveredOperations = new Set<string>();

/** Every violation/finding recorded SINCE THE LAST DRAIN, plus the
 * cumulative (never drained) coverage set — read-only snapshots for a
 * triage script (`payload-schema-validation.spec.ts`'s own
 * "auto-validation inventory" test reads these across a whole run without
 * draining the violation lists, by calling this instead of the per-test
 * assertion below). */
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
    // Not bodyless/binary in general (those never reach this function —
    // see `installResponseValidation` below) — specifically, THIS status
    // code has no declared schema on THIS operation.
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

/**
 * Adds the capture-and-validate middleware to `app`. Call once, from
 * `buildContractTestApp`, before `app.init()`.
 */
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
        // A binary download (e.g. `downloadAttachmentContent`) streams via
        // `.pipe()`/`res.write()` directly and never calls `res.json`/
        // `res.send` — nothing was captured, which is exactly the expected
        // shape for an operation this file's own header already excludes
        // by design (FR-017). Nothing to record.
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
          // A JSON content-type header with a body that does not actually
          // parse as JSON is itself a real defect, but a different one
          // than a schema-shape mismatch — out of this file's scope.
          return;
        }
      }

      recordForOperation(operation, req.method, path, res.statusCode, body);
    });

    next();
  });
}

/** Drains and returns everything recorded since the last drain — the
 * per-test assertion below calls this so each test's own failure message
 * shows only what THAT test produced, not the whole run's accumulation. */
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

/**
 * Called from a module-level `afterEach` in `contract-app.ts` — fails the
 * JUST-FINISHED test if any response IT produced violated its own
 * contract's schema. Undocumented-status findings are reported (via
 * `console.warn`, matching this suite's existing convention for
 * non-fatal-but-worth-seeing diagnostics) but do not fail the test — an
 * undocumented status is a contract-completeness gap (a different, already
 * separately-tracked class of finding), not a payload-shape defect.
 */
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
