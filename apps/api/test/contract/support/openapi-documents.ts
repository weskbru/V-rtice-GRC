/**
 * T031/D-9 (007-implementation-remediation) — loads the ten hand-authored
 * OpenAPI contracts (the same ten `packages/api-types/scripts/generate.mjs`
 * generates from, research.md D-8) via the `yaml` package, and derives, from
 * the documents themselves rather than by hand, the inventory FR-017
 * requires: which operations have no response body to validate (e.g. `204`)
 * and which return something other than JSON (a binary download).
 *
 * Why `yaml` here and not the hand-rolled line scanner
 * `contract-coverage.spec.ts` already uses: that scanner answers "does this
 * `{method, path}` exist" — a structural presence check that never needs to
 * look inside a schema. The payload validator (`payload-validator.ts`) needs
 * the actual `responses.<status>.content.<mediaType>.schema` value, which
 * means parsing the document for real. `yaml` is a new, justified dependency
 * for exactly that (research.md D-9) rather than duplicating a hand-rolled
 * parser for a job a real one already does correctly.
 *
 * One parsed document per contract, cached: these files are read from disk
 * once per test run, never per test.
 *
 * ## Typing
 *
 * `parse()` returns `unknown` by design (this package cannot know the shape
 * of an arbitrary YAML file) — `OpenApiDocument` below is a deliberately
 * MINIMAL structural type covering only the parts this file and
 * `payload-validator.ts` actually read (`paths`, one operation's
 * `operationId`/`responses`). It is not, and does not attempt to be, a
 * complete OpenAPI 3.1 type — the ten contracts' full shape is already
 * authoritatively typed by `packages/api-types`' own generated output for
 * every OTHER purpose; this narrow slice exists only so `apps/api`'s strict
 * lint (`no-explicit-any`/`no-unsafe-*`) has something real to check against
 * here, without depending on `@pharos/api-types` for it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

/** Mirrors `packages/api-types/scripts/generate.mjs`'s own `DOCUMENTS` list
 * (research.md D-8) — kept as a second, independent list rather than a
 * shared import because that generator's module lives in a different
 * workspace package (`@pharos/api-types`) apps/api does not, and should
 * not, depend on at runtime for this; both lists enumerate the same ten
 * contracts by design, and `contract-coverage.spec.ts`'s own
 * `CONTRACT_SOURCES` is the third independent list. All three ever
 * disagreeing is a real hazard this file does not itself guard — see this
 * front's report for the recommendation to add that guard as follow-on
 * work. */
export const CONTRACT_DOCUMENTS = {
  Auth: { specDir: '001-grc-platform-foundation', file: 'auth.openapi.yaml' },
  Admin: { specDir: '001-grc-platform-foundation', file: 'admin.openapi.yaml' },
  Platform: { specDir: '001-grc-platform-foundation', file: 'platform.openapi.yaml' },
  Risks: { specDir: '001-grc-platform-foundation', file: 'risks.openapi.yaml' },
  GrcFoundation: { specDir: '002-shared-grc-foundation', file: 'grc-foundation.openapi.yaml' },
  Controls: { specDir: '003-controls-management', file: 'controls.openapi.yaml' },
  Compliance: { specDir: '004-compliance-management', file: 'compliance.openapi.yaml' },
  Audit: { specDir: '005-audit-findings', file: 'audit.openapi.yaml' },
  Assets: { specDir: '006-assets-processes', file: 'assets.openapi.yaml' },
  Processes: { specDir: '006-assets-processes', file: 'processes.openapi.yaml' },
  // 008-incidents-problems, US2 — added alongside `ProblemController`
  // (create/read/list/update/transition, operations 1-2/4-5 of
  // contracts/problems.openapi.yaml). Deliberately NOT added to
  // `contract-coverage.spec.ts`'s own `CONTRACT_SOURCES` yet: that check
  // requires EVERY operation a contract declares to already be
  // registered, and this pass does not implement the link operations
  // (3, 6-9, Problem<->Risk/Problem<->Incident) — mirrors
  // `004-compliance-management`'s own documented deferral ("the previous
  // workstream deliberately deferred adding this entry to whichever task
  // completed the whole contract"). `matchOperationForRequest` below has
  // no such all-or-nothing requirement — it only ever matches a REAL
  // response the contract suite actually produces, so registering the
  // document here now is safe and lets `auto-validate-responses.ts`
  // validate every response THIS pass's own contract tests exercise.
  Problems: { specDir: '008-incidents-problems', file: 'problems.openapi.yaml' },
  // 008-incidents-problems, US1 — added alongside `IncidentController`
  // (create/read/list/update/transition, operations 1-4 of
  // contracts/incidents.openapi.yaml). Same deliberate omission from
  // `contract-coverage.spec.ts`'s own `CONTRACT_SOURCES` as `Problems`
  // above: the relationship/link operations (5-14, Incident<->Risk/
  // Asset/Process/Problem) belong to a separate front.
  Incidents: { specDir: '008-incidents-problems', file: 'incidents.openapi.yaml' },
  // 009-indicators-reports, Fase 3 (T030/T031) + Fase 8 (T068) — added
  // alongside `IndicatorController` (`listIndicatorDefinitions`/
  // `createIndicatorDefinition`/`getIndicatorCurrentValue`, US1's own three
  // operations, this feature's MVP checkpoint). T068 completed the
  // contract's remaining three operations
  // (`listIndicatorMetricKeys`/`getIndicatorDefinition`/
  // `updateIndicatorDefinition`) in the same change that adds
  // `indicators.openapi.yaml` to `contract-coverage.spec.ts`'s own
  // `CONTRACT_SOURCES` — see that file's own entry and this task's final
  // report.
  Indicators: { specDir: '009-indicators-reports', file: 'indicators.openapi.yaml' },
  // 009-indicators-reports, Fase 7 (T054) + Fase 8 (T068) — added alongside
  // `ReportController` (`listReportDefinitions`/`createReportDefinition`/
  // `runReport`, US5's own three operations — `runReport` serves both the
  // JSON and `text/csv` response declared on the same operation). T068
  // completed the contract's remaining two operations
  // (`getReportDefinition`/`updateReportDefinition`) in the same change
  // that adds `reports.openapi.yaml` to `contract-coverage.spec.ts`'s own
  // `CONTRACT_SOURCES` — see that file's own entry and this task's final
  // report.
  Reports: { specDir: '009-indicators-reports', file: 'reports.openapi.yaml' },
} as const;

export type ContractDocumentKey = keyof typeof CONTRACT_DOCUMENTS;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface OpenApiMediaType {
  readonly schema?: unknown;
}

export interface OpenApiResponse {
  readonly content?: Readonly<Record<string, OpenApiMediaType>>;
  /** All ten contracts commonly declare a shared response (`Unauthorized`,
   * `Forbidden`, ...) once, under `components.responses`, and reference it
   * from many operations as `{ $ref: '#/components/responses/X' }` rather
   * than repeating its `content` inline — verified directly (`risks
   * .openapi.yaml`'s own `'401': { $ref: '#/components/responses
   * /Unauthorized' }`, `grc-foundation.openapi.yaml`'s identical pattern).
   * A response entry shaped this way carries `$ref`, never `content`,
   * directly. */
  readonly $ref?: string;
}

export interface OpenApiOperation {
  readonly operationId?: string;
  readonly responses?: Readonly<Record<string, OpenApiResponse>>;
}

export type OpenApiPathItem = Readonly<Partial<Record<HttpMethod, OpenApiOperation>>>;

export interface OpenApiDocument {
  readonly paths?: Readonly<Record<string, OpenApiPathItem>>;
  readonly components?: {
    readonly schemas?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, OpenApiResponse>>;
  };
}

/**
 * Resolves a response entry that may itself be `{ $ref: '#/components/
 * responses/X' }` to the REAL response object it points at, plus the JSON
 * Pointer path (relative to the document root) that real object lives at —
 * needed so `payload-validator.ts` can build a schema reference against the
 * location Ajv actually indexed, not the `$ref` indirection.
 *
 * Only one level of indirection is resolved (`components.responses` never
 * itself contains a `$ref` to another `components.responses` entry in any
 * of the ten contracts — verified directly) — a second level would need a
 * loop, deliberately not written until a real contract needs it.
 */
export function resolveResponseObject(
  doc: OpenApiDocument,
  responseEntry: OpenApiResponse,
  ownPointer: string,
): { readonly response: OpenApiResponse; readonly pointer: string } {
  if (!responseEntry.$ref) {
    return { response: responseEntry, pointer: ownPointer };
  }
  // `#/components/responses/Unauthorized` -> `components.responses.Unauthorized`
  const refPath = responseEntry.$ref.replace(/^#\//, '').split('/');
  const target = refPath.reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, doc);
  if (!target) {
    throw new Error(`Could not resolve response $ref "${responseEntry.$ref}".`);
  }
  return { response: target, pointer: `/${refPath.join('/')}` };
}

const specsRoot = path.resolve(__dirname, '../../../../../specs');

const documentCache = new Map<ContractDocumentKey, OpenApiDocument>();

/** Parses (and caches) one of the ten contracts by its namespace key —
 * the same key `packages/api-types` generates a namespace under. */
export function loadContractDocument(key: ContractDocumentKey): OpenApiDocument {
  const cached = documentCache.get(key);
  if (cached) {
    return cached;
  }

  const { specDir, file } = CONTRACT_DOCUMENTS[key];
  const sourcePath = path.resolve(specsRoot, specDir, 'contracts', file);
  const raw = readFileSync(sourcePath, 'utf-8');
  const doc = parse(raw) as OpenApiDocument;
  documentCache.set(key, doc);
  return doc;
}

export interface ContractOperation {
  readonly documentKey: ContractDocumentKey;
  readonly path: string;
  readonly method: HttpMethod;
  readonly operationId: string;
  readonly operation: OpenApiOperation;
}

/** Every operation across all ten documents, flattened. */
export function listAllOperations(): readonly ContractOperation[] {
  const operations: ContractOperation[] = [];

  for (const documentKey of Object.keys(CONTRACT_DOCUMENTS) as ContractDocumentKey[]) {
    const doc = loadContractDocument(documentKey);
    const paths = doc.paths ?? {};
    for (const [operationPath, pathItem] of Object.entries(paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation?.operationId) {
          continue;
        }
        operations.push({
          documentKey,
          path: operationPath,
          method,
          operationId: operation.operationId,
          operation,
        });
      }
    }
  }

  return operations;
}

const JSON_CONTENT_TYPES = new Set(['application/json', 'application/problem+json']);

export interface OperationBodyClassification {
  readonly hasJsonBody: boolean;
  readonly hasNonJsonBody: boolean;
  readonly hasAnySuccessResponse: boolean;
}

/** Classifies one operation's SUCCESS (2xx) responses only — a validator
 * checks success shapes and `application/problem+json` failures (FR-017);
 * problem responses are never binary and never bodyless, so only the
 * success side needs this classification to build the FR-017 exclusion
 * inventory. */
export function classifyOperationBody(operation: OpenApiOperation): OperationBodyClassification {
  const responses = operation.responses ?? {};
  const successCodes = Object.keys(responses).filter((code) => /^2\d\d$/.test(code));

  let hasJsonBody = false;
  let hasNonJsonBody = false;

  for (const code of successCodes) {
    const content = responses[code]?.content;
    if (!content) {
      continue;
    }
    const contentTypes = Object.keys(content);
    if (contentTypes.some((type) => JSON_CONTENT_TYPES.has(type))) {
      hasJsonBody = true;
    }
    if (contentTypes.some((type) => !JSON_CONTENT_TYPES.has(type))) {
      hasNonJsonBody = true;
    }
  }

  return { hasJsonBody, hasNonJsonBody, hasAnySuccessResponse: successCodes.length > 0 };
}

/**
 * FR-017's required inventory, DERIVED from the ten contracts rather than
 * hand-maintained — it can never silently drift from what the documents
 * actually declare. Two categories:
 *
 *   - `noBody`: every success response is bodyless (e.g. `204`) — nothing
 *     for a payload validator to check.
 *   - `binary`: the only success body is non-JSON (e.g.
 *     `downloadAttachmentContent`'s `application/octet-stream` /
 *     arbitrary file content-type) — out of scope for a JSON Schema
 *     validator by definition.
 *
 * An operation with BOTH a JSON success response and a binary one (none of
 * the ten documents currently declare this shape) would be covered, not
 * excluded — this inventory only excludes an operation when JSON coverage
 * is impossible, never when it is merely partial.
 */
export function buildBodyExclusionInventory(): {
  readonly noBody: readonly ContractOperation[];
  readonly binary: readonly ContractOperation[];
} {
  const noBody: ContractOperation[] = [];
  const binary: ContractOperation[] = [];

  for (const op of listAllOperations()) {
    const classification = classifyOperationBody(op.operation);
    if (!classification.hasAnySuccessResponse) {
      continue;
    }
    if (!classification.hasJsonBody && !classification.hasNonJsonBody) {
      noBody.push(op);
    } else if (!classification.hasJsonBody && classification.hasNonJsonBody) {
      binary.push(op);
    }
  }

  return { noBody, binary };
}

/** Finds one operation by document + operationId — the lookup key the
 * payload validator and its tests use (matches `contract-coverage.spec.ts`'s
 * own convention of naming operations by `operationId`, not by
 * `{method, path}`, so a failure message is greppable against the
 * contract). */
export function findOperation(
  documentKey: ContractDocumentKey,
  operationId: string,
): ContractOperation {
  const doc = loadContractDocument(documentKey);
  const paths = doc.paths ?? {};
  for (const [operationPath, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation?.operationId === operationId) {
        return { documentKey, path: operationPath, method, operationId, operation };
      }
    }
  }
  throw new Error(`No operation "${operationId}" found in the ${documentKey} contract.`);
}

/** One compiled operation, ready for matching a real incoming request's
 * `{method, path}` against its OpenAPI path TEMPLATE (`/risks/{riskId}`,
 * not the literal path any given request actually used). Built once and
 * cached — `matchOperationForRequest` runs on every response the contract
 * suite produces, so this must not re-parse ten YAML files per request. */
interface CompiledOperationMatcher {
  readonly operation: ContractOperation;
  readonly segments: readonly string[];
}

let compiledMatchers: readonly CompiledOperationMatcher[] | undefined;

function compileMatchers(): readonly CompiledOperationMatcher[] {
  if (compiledMatchers) {
    return compiledMatchers;
  }
  compiledMatchers = listAllOperations().map((operation) => ({
    operation,
    segments: operation.path.split('/').filter((segment) => segment.length > 0),
  }));
  return compiledMatchers;
}

/**
 * Matches a REAL request's method + path (already stripped of the
 * `/api/v1` global prefix, e.g. `/risks/3fa85f64-...`) against the operation
 * whose OpenAPI path TEMPLATE it satisfies (`/risks/{riskId}`) — segment
 * count must match exactly, every literal segment must match verbatim, and
 * every `{param}` segment matches any single non-empty path segment.
 *
 * This is what lets `auto-validate-responses.ts` attribute an arbitrary
 * live response to its contract operation without the contract suite's own
 * spec files knowing anything about it — no test file names an
 * `operationId`, no test file imports this function.
 *
 * Returns `undefined` for a path this generator recognizes as NOT
 * contracted (there is no such thing today — every registered route has a
 * contract entry, `contract-coverage.spec.ts`'s own job — but a future
 * route added to `AppModule` without a matching contract entry must fail
 * open here, not throw, so an uncontracted route never crashes every other
 * passing test in the same file via this middleware).
 */
export function matchOperationForRequest(
  method: string,
  requestPath: string,
): ContractOperation | undefined {
  const normalizedMethod = method.toLowerCase();
  if (!(HTTP_METHODS as readonly string[]).includes(normalizedMethod)) {
    return undefined;
  }
  const requestSegments = requestPath.split('/').filter((segment) => segment.length > 0);

  for (const candidate of compileMatchers()) {
    if (candidate.operation.method !== normalizedMethod) {
      continue;
    }
    if (candidate.segments.length !== requestSegments.length) {
      continue;
    }
    const matches = candidate.segments.every((templateSegment, index) => {
      const requestSegment = requestSegments[index];
      if (requestSegment === undefined) {
        return false;
      }
      if (templateSegment.startsWith('{') && templateSegment.endsWith('}')) {
        return requestSegment.length > 0;
      }
      return templateSegment === requestSegment;
    });
    if (matches) {
      return candidate.operation;
    }
  }
  return undefined;
}
