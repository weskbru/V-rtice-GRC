/**
 * T031 (007-implementation-remediation, research.md D-9) — a real payload
 * validator against the hand-authored OpenAPI contracts, built on `ajv`
 * (2020-12 dialect) + `ajv-formats`, reading component schemas parsed by
 * `openapi-documents.ts`. This is what neither `openapi:check` (route-level
 * drift only, F-3) nor `contract-coverage.spec.ts` (operation PRESENCE only,
 * F-31) can do: check that a real response BODY actually matches its
 * contract's schema — required, optional, enum membership and nullability.
 *
 * ## Why the whole document is registered as one Ajv schema
 *
 * None of the ten contracts uses `$ref` across files (verified directly —
 * every `$ref` is `#/components/...`), so each document can be registered
 * with Ajv under its own `$id` (the namespace key) and every internal
 * `#/components/schemas/X` reference resolves against that same document
 * with no external dereferencer (research.md D-9's own design note).
 *
 * ## `strict: false`
 *
 * An OpenAPI document carries keys no JSON Schema validator recognises at
 * the schema level — `openapi`, `info`, `paths`, `servers`, `tags` at the
 * document root, and the OpenAPI-specific (not JSON Schema 2020-12)
 * `example` annotation inside individual schemas (`examples` IS a real
 * 2020-12 keyword and needs no accommodation). Ajv's strict mode treats an
 * unrecognised keyword as an error by default. Verified directly against
 * all ten documents (research.md D-9): `example`/`examples` are the ONLY
 * non-JSON-Schema annotations present, and both are pure annotations with
 * zero effect on validation — turning strict mode off to tolerate them is
 * not a validation-strength concession, only a schema-shape one.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import {
  loadContractDocument,
  resolveResponseObject,
  type ContractDocumentKey,
  type ContractOperation,
} from './openapi-documents';

import type { ErrorObject, ValidateFunction } from 'ajv';

const ajv = new Ajv2020({
  strict: false,
  allErrors: true,
  // OpenAPI 3.1 schemas are read-only/write-only aware (`readOnly`,
  // `writeOnly`) but Ajv treats both as pure annotations unless told
  // otherwise — a response validator (this file's only job) must still
  // accept a `readOnly` field being present, which is the default; nothing
  // extra to configure for that direction.
  discriminator: false,
});
addFormats(ajv);

const registeredDocuments = new Set<ContractDocumentKey>();

function ensureDocumentRegistered(documentKey: ContractDocumentKey): void {
  if (registeredDocuments.has(documentKey)) {
    return;
  }
  const doc = loadContractDocument(documentKey);
  // `OpenApiDocument` (see `openapi-documents.ts`) is a real, narrow
  // structural type, not `any` — and it turns out to already satisfy Ajv's
  // own `AnySchemaObject` structurally (an index-signature-free object
  // type), so no cast is needed to hand the whole document to Ajv here.
  ajv.addSchema(doc, documentKey);
  registeredDocuments.add(documentKey);
}

const compiledValidators = new Map<string, ValidateFunction>();

/** Compiles (and caches) a validator for one named component schema within
 * one document — e.g. `getComponentSchemaValidator('GrcFoundation',
 * 'Action')`. */
function getComponentSchemaValidator(
  documentKey: ContractDocumentKey,
  schemaName: string,
): ValidateFunction {
  const cacheKey = `${documentKey}#/components/schemas/${schemaName}`;
  const cached = compiledValidators.get(cacheKey);
  if (cached) {
    return cached;
  }

  ensureDocumentRegistered(documentKey);
  const validate = ajv.getSchema(cacheKey);
  if (!validate) {
    throw new Error(
      `Ajv could not resolve ${cacheKey} — check the schema name against the contract's own ` +
        `components.schemas keys.`,
    );
  }
  compiledValidators.set(cacheKey, validate);
  return validate;
}

export interface ResponseSchemaLookup {
  /** JSON Pointer (RFC 6901, already `~0`/`~1`-escaped) from the document
   * root to this response's schema — e.g.
   * `/paths/~1evidence/get/responses/200/content/application~1json/schema`.
   * Resolving THIS pointer against the already-registered document (rather
   * than extracting the schema object and recompiling it standalone) is
   * what keeps every `$ref: '#/components/schemas/X'` inside it correctly
   * relative to the document's own root — the standalone-extraction
   * approach breaks exactly that resolution for any nested `$ref`. */
  readonly jsonPointer: string;
  readonly contentType: string;
}

/** JSON Pointer segment escaping per RFC 6901: `~` -> `~0`, `/` -> `~1`. */
function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Resolves the response schema LOCATION for one operation + status code —
 * reading `responses.<status>.content.<mediaType>.schema`, preferring
 * `application/json`, falling back to `application/problem+json`. Returns
 * `undefined` for a status this operation does not declare, or a status
 * whose response has no JSON body (see `buildBodyExclusionInventory` for
 * the documented, derived list of bodyless/binary operations).
 *
 * Follows ONE level of `$ref` at the response-object level first
 * (`resolveResponseObject`) — many operations across all ten contracts
 * declare `'401': { $ref: '#/components/responses/Unauthorized' }` rather
 * than repeating that response's `content` inline. Without this, every
 * such status would be misread as "undocumented" (no `content` key
 * directly on the `$ref` pointer object) even though the contract
 * genuinely documents it. */
export function resolveResponseSchema(
  operation: ContractOperation,
  statusCode: number,
): ResponseSchemaLookup | undefined {
  const rawResponseEntry = operation.operation.responses?.[String(statusCode)];
  if (!rawResponseEntry) {
    return undefined;
  }

  const ownPointer = [
    '',
    'paths',
    escapePointerSegment(operation.path),
    operation.method,
    'responses',
    String(statusCode),
  ].join('/');

  const doc = loadContractDocument(operation.documentKey);
  const { response: responseEntry, pointer: responsePointer } = resolveResponseObject(
    doc,
    rawResponseEntry,
    ownPointer,
  );

  const content = responseEntry.content;
  if (!content) {
    return undefined;
  }
  const contentType = content['application/json']
    ? 'application/json'
    : content['application/problem+json']
      ? 'application/problem+json'
      : undefined;
  if (!contentType) {
    return undefined;
  }

  const jsonPointer = `${responsePointer}/content/${escapePointerSegment(contentType)}/schema`;

  return { jsonPointer, contentType };
}

export interface PayloadValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const location = error.instancePath || '(root)';
    return (
      `${location} ${error.message ?? 'failed validation'} ` +
      `(keyword: ${error.keyword}${error.params ? `, params: ${JSON.stringify(error.params)}` : ''})`
    );
  });
}

/**
 * Validates `body` against `operation`'s declared response schema for
 * `statusCode`, within `documentKey`. This is the function every contract
 * test in `payload-schema-validation.spec.ts` calls — success responses
 * AND `application/problem+json` failures alike (FR-017), since both are
 * ordinary JSON Schema validations once the response schema is resolved.
 *
 * Throws (rather than returning an unhelpful `{valid:false}`) when the
 * operation has no schema for this status at all — that is a test-authoring
 * mistake (validating a status the contract never declared a body for),
 * not a payload defect, and FR-017's own exclusion list
 * (`buildBodyExclusionInventory`) is how a genuinely bodyless/binary
 * operation is meant to be skipped instead.
 */
export function validateResponseBody(
  operation: ContractOperation,
  statusCode: number,
  body: unknown,
): PayloadValidationResult {
  const lookup = resolveResponseSchema(operation, statusCode);
  if (!lookup) {
    throw new Error(
      `${operation.operationId} declares no JSON response body for status ${String(statusCode)} — ` +
        'this status is not validatable; check buildBodyExclusionInventory() before calling this ' +
        'function for a bodyless or binary operation.',
    );
  }

  const { documentKey } = operation;
  ensureDocumentRegistered(documentKey);

  // Resolved by JSON Pointer INTO the already-registered document (never by
  // extracting the schema object and recompiling it standalone) — this is
  // what keeps every `$ref: '#/components/schemas/X'` inside the response
  // schema, nested or not, resolving against the document's own root. See
  // `ResponseSchemaLookup`'s own doc comment for why the standalone-object
  // approach silently breaks nested refs.
  const schemaRef = `${documentKey}#${lookup.jsonPointer}`;
  let validate = compiledValidators.get(schemaRef);
  if (!validate) {
    const resolved = ajv.getSchema(schemaRef);
    if (!resolved) {
      throw new Error(`Ajv could not resolve ${schemaRef} for operation ${operation.operationId}.`);
    }
    validate = resolved;
    compiledValidators.set(schemaRef, validate);
  }

  const valid = validate(body);
  return { valid, errors: formatErrors(validate.errors) };
}

/** Validates `body` directly against a named component schema — used by
 * the T033 negative-proof test, which needs to validate a mutated payload
 * against a schema it names explicitly rather than by operation+status. */
export function validateAgainstSchema(
  documentKey: ContractDocumentKey,
  schemaName: string,
  body: unknown,
): PayloadValidationResult {
  const validate = getComponentSchemaValidator(documentKey, schemaName);
  const valid = validate(body);
  return { valid, errors: formatErrors(validate.errors) };
}
